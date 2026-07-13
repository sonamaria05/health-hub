import { describe, it, expect } from 'vitest';
import { predictHealthRisksFromSnapshot, type FeatureSnapshot } from '@/lib/mlRisk';
import goldenPredictions from './fixtures/mlGoldenPredictions.json';

const TARGET_TO_CONDITION: Record<string, string> = {
  anemia: 'Anemia Risk',
  diabetes: 'Diabetes Risk',
  cardiovascular: 'Cardiovascular Risk',
  kidney: 'Kidney Function Risk',
};

describe('ML inference engine matches real sklearn/xgboost predictions', () => {
  for (const golden of goldenPredictions as Array<{
    target: string;
    model_type: string;
    featureSnapshot: FeatureSnapshot;
    expectedProbability: number;
  }>) {
    it(`reproduces the trained ${golden.model_type} model's probability for ${golden.target}`, () => {
      const predictions = predictHealthRisksFromSnapshot(golden.featureSnapshot);
      const match = predictions.find((p) => p.condition === TARGET_TO_CONDITION[golden.target]);
      expect(match).toBeDefined();

      const actualProbability = (match!.probability as number) / 100;
      // The golden fixture is rounded to 6 decimal places by the Python
      // generator; allow a small tolerance for the JSON round-trip and
      // the TS side's own rounding to whole percentage points.
      expect(actualProbability).toBeCloseTo(golden.expectedProbability, 2);
    });
  }
});
