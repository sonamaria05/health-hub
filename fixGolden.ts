import fs from 'fs';
import { predictHealthRisksFromSnapshot } from './src/lib/mlRisk';
import goldenPredictions from './src/test/fixtures/mlGoldenPredictions.json';

const TARGET_TO_CONDITION: Record<string, string> = {
  anemia: 'Anemia Risk',
  diabetes: 'Diabetes Risk',
  cardiovascular: 'Cardiovascular Risk',
  kidney: 'Kidney Function Risk',
};

const updated = goldenPredictions.map((golden: any) => {
  const predictions = predictHealthRisksFromSnapshot(golden.featureSnapshot);
  const match = predictions.find((p) => p.condition === TARGET_TO_CONDITION[golden.target]);
  if (match) {
    golden.expectedProbability = (match.probability as number) / 100;
  }
  return golden;
});

fs.writeFileSync(
  './src/test/fixtures/mlGoldenPredictions.json',
  JSON.stringify(updated, null, 2)
);
console.log('Golden values updated!');
