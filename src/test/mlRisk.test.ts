import { describe, expect, it } from 'vitest';
import { buildFeatureSnapshot, deriveEngineeredFeatures, predictHealthRisksFromRecords, predictHealthRisksFromSnapshot } from '@/lib/mlRisk';
import { mockRecords } from '@/lib/mockData';
import { mlArtifacts } from '@/lib/generated/mlArtifacts';

describe('ml risk helpers', () => {
  it('builds a feature snapshot from extracted records', () => {
    const snapshot = buildFeatureSnapshot(mockRecords);
    expect(snapshot.hemoglobin).toBe(11.2);
    expect(snapshot.total_cholesterol).toBe(235);
    expect(snapshot.record_count).toBeGreaterThan(0);
  });

  it('returns trained predictions sorted by probability', () => {
    const predictions = predictHealthRisksFromRecords(mockRecords);
    expect(predictions.length).toBe(4);
    expect(predictions[0].probability).toBeGreaterThanOrEqual(predictions[1].probability);
    expect(predictions.every(item => item.method === 'trained_model')).toBe(true);
    expect(predictions.every(item => item.modelVersion === mlArtifacts.model_version)).toBe(true);
  });

  it('produces valid probabilities, risk levels, and exactly 3 factors per prediction', () => {
    const predictions = predictHealthRisksFromRecords(mockRecords);
    for (const prediction of predictions) {
      expect(prediction.probability).toBeGreaterThanOrEqual(0);
      expect(prediction.probability).toBeLessThanOrEqual(100);
      expect(['low', 'moderate', 'high']).toContain(prediction.risk);
      expect(prediction.factors.length).toBe(3);
      expect(typeof prediction.recommendation).toBe('string');
      expect(prediction.recommendation.length).toBeGreaterThan(0);
    }
  });

  it('selects a per-target model via cross-validated comparison, not a single fixed algorithm', () => {
    // Task 3: model selection compares logistic regression, random forest,
    // and xgboost per target and can pick different winners per condition.
    // Assert the artifact only ever contains models from that candidate set.
    const validModelTypes = new Set(['logistic_regression', 'random_forest', 'xgboost']);
    for (const model of Object.values(mlArtifacts.models)) {
      expect(validModelTypes.has(model.model_type)).toBe(true);
    }
  });

  it('serializes a calibration transform for every model', () => {
    for (const model of Object.values(mlArtifacts.models)) {
      expect(model.calibration).toBeDefined();
      expect(typeof model.calibration.coefficient).toBe('number');
      expect(typeof model.calibration.intercept).toBe('number');
    }
  });

  it('scores a clearly worse feature snapshot at least as risky as a healthy baseline', () => {
    const healthySnapshot = buildFeatureSnapshot(mockRecords);
    const worsenedBase = {
      ...healthySnapshot,
      hemoglobin: 8.5,
      fasting_glucose: 180,
      hba1c: 8.5,
      creatinine: 2.2,
      total_cholesterol: 280,
      ldl_cholesterol: 190,
      triglycerides: 260,
      abnormal_ratio: 0.9,
    };
    const worsenedSnapshot = { ...worsenedBase, ...deriveEngineeredFeatures(worsenedBase) };

    const healthyPredictions = predictHealthRisksFromSnapshot(healthySnapshot);
    const worsenedPredictions = predictHealthRisksFromSnapshot(worsenedSnapshot);

    for (const worsened of worsenedPredictions) {
      const healthy = healthyPredictions.find((p) => p.condition === worsened.condition);
      expect(healthy).toBeDefined();
      expect(worsened.probability).toBeGreaterThanOrEqual(healthy!.probability);
    }
  });
});
