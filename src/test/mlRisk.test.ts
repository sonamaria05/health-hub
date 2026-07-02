import { describe, expect, it } from 'vitest';
import { buildFeatureSnapshot, predictHealthRisksFromRecords } from '@/lib/mlRisk';
import { mockRecords } from '@/lib/mockData';

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
    expect(predictions.every(item => item.modelVersion === 'ensemble-tabular-v2')).toBe(true);
  });
});
