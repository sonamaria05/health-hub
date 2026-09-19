import { mlArtifacts } from './generated/mlArtifacts';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface ExtractedMetric {
  value: number;
  unit: string;
  normalRange: string;
  status: 'normal' | 'high' | 'low';
}

export interface RecordLike {
  date?: string;
  extractedData?: Record<string, ExtractedMetric>;
}

export interface FeatureSnapshot {
  hemoglobin: number;
  fasting_glucose: number;
  total_cholesterol: number;
  creatinine: number;
  hba1c: number;
  ldl_cholesterol: number;
  triglycerides: number;
  abnormal_ratio: number;
  record_count: number;
  anemia_signal: number;
  glycemic_signal: number;
  lipid_signal: number;
  kidney_signal: number;
  risk_burden: number;
  glucose_hba1c_interaction: number;
  lipid_density: number;
  renal_load: number;
}

export interface HealthRiskPrediction {
  condition: string;
  risk: RiskLevel;
  probability: number;
  factors: string[];
  recommendation: string;
  method: 'trained_model';
  modelVersion: string;
}

type FeatureKey = keyof FeatureSnapshot;
type ModelKey = keyof typeof mlArtifacts.models;
type ModelArtifact = (typeof mlArtifacts.models)[ModelKey];

const MODEL_VERSION = mlArtifacts.model_version;
const featureDefinitions = mlArtifacts.feature_definitions;
const modelArtifacts = mlArtifacts.models;
const allFeatures = mlArtifacts.all_features as unknown as readonly FeatureKey[];
const featureBaseline = mlArtifacts.feature_baseline;

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function toRiskLevel(probability: number, threshold: number): RiskLevel {
  const highThreshold = Math.min(Math.max(threshold + 0.2, 0.72), 0.9);
  if (probability >= highThreshold) return 'high';
  if (probability >= threshold) return 'moderate';
  return 'low';
}

function getLatestMetricValue(records: RecordLike[], aliases: readonly string[]) {
  const sortedRecords = [...records].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  const normalizedAliases = aliases.map((a) => a.toLowerCase().trim());

  for (let index = sortedRecords.length - 1; index >= 0; index -= 1) {
    const extractedData = sortedRecords[index].extractedData ?? {};
    for (const [key, metric] of Object.entries(extractedData)) {
      const normalizedKey = key.toLowerCase().trim();
      if (metric?.value != null && (normalizedAliases.includes(normalizedKey) || normalizedAliases.some(a => normalizedKey.includes(a) || a.includes(normalizedKey)))) {
        return metric.value;
      }
    }
  }

  return undefined;
}

export function deriveEngineeredFeatures(base: Omit<FeatureSnapshot, 'anemia_signal' | 'glycemic_signal' | 'lipid_signal' | 'kidney_signal' | 'risk_burden' | 'glucose_hba1c_interaction' | 'lipid_density' | 'renal_load'>) {
  const anemiaSignal = Math.max(0, 12 - base.hemoglobin);
  const glycemicSignal = Math.max(0, base.fasting_glucose - 100) + Math.max(0, (base.hba1c - 5.7) * 18);
  const lipidSignal =
    Math.max(0, base.total_cholesterol - 200) +
    Math.max(0, base.ldl_cholesterol - 100) +
    0.45 * Math.max(0, base.triglycerides - 150);
  const kidneySignal = Math.max(0, (base.creatinine - 1.2) * 100);
  const riskBurden = base.abnormal_ratio * 100 + 1.4 * anemiaSignal + 0.1 * glycemicSignal + 0.035 * lipidSignal + 0.08 * kidneySignal;
  const glucoseHba1cInteraction = (base.fasting_glucose * base.hba1c) / 100;
  const lipidDensity = (base.total_cholesterol + base.ldl_cholesterol + 0.5 * base.triglycerides) / Math.max(base.record_count, 1);
  const renalLoad = base.creatinine * (1 + base.abnormal_ratio) * base.record_count;

  return {
    anemia_signal: anemiaSignal,
    glycemic_signal: glycemicSignal,
    lipid_signal: lipidSignal,
    kidney_signal: kidneySignal,
    risk_burden: riskBurden,
    glucose_hba1c_interaction: glucoseHba1cInteraction,
    lipid_density: lipidDensity,
    renal_load: renalLoad,
  };
}

export function buildFeatureSnapshot(records: RecordLike[]): FeatureSnapshot {
  const recordsWithData = records.filter(record => Object.keys(record.extractedData ?? {}).length > 0);
  let totalMetrics = 0;
  let abnormalMetrics = 0;

  for (const record of recordsWithData) {
    for (const metric of Object.values(record.extractedData ?? {})) {
      totalMetrics += 1;
      if (metric.status !== 'normal') {
        abnormalMetrics += 1;
      }
    }
  }

  const base = {
    hemoglobin: getLatestMetricValue(recordsWithData, featureDefinitions.hemoglobin.aliases) ?? 12.2,
    fasting_glucose: getLatestMetricValue(recordsWithData, featureDefinitions.fasting_glucose.aliases) ?? 101,
    total_cholesterol: getLatestMetricValue(recordsWithData, featureDefinitions.total_cholesterol.aliases) ?? 205,
    creatinine: getLatestMetricValue(recordsWithData, featureDefinitions.creatinine.aliases) ?? 1.0,
    hba1c: getLatestMetricValue(recordsWithData, featureDefinitions.hba1c.aliases) ?? 5.6,
    ldl_cholesterol: getLatestMetricValue(recordsWithData, featureDefinitions.ldl_cholesterol.aliases) ?? 130,
    triglycerides: getLatestMetricValue(recordsWithData, featureDefinitions.triglycerides.aliases) ?? 145,
    abnormal_ratio: totalMetrics > 0 ? abnormalMetrics / totalMetrics : 0.18,
    record_count: Math.max(recordsWithData.length, 1),
  };

  return {
    ...base,
    ...deriveEngineeredFeatures(base),
  };
}

function formatFeatureValue(key: FeatureKey, value: number) {
  const feature = featureDefinitions[key];
  if (!feature) {
    return `${key}: ${value.toFixed(2)}`;
  }

  if (feature.unit === '%' || feature.unit === 'score') {
    return `${feature.label}: ${value.toFixed(1)} ${feature.unit}`;
  }
  if (feature.unit === 'count') {
    return `${feature.label}: ${value.toFixed(0)}`;
  }
  return `${feature.label}: ${value.toFixed(2)} ${feature.unit}`;
}

function formatFactor(key: FeatureKey, snapshot: FeatureSnapshot) {
  if (key === 'abnormal_ratio') {
    return `Abnormal marker ratio is ${(snapshot.abnormal_ratio * 100).toFixed(0)}% across saved reports.`;
  }
  if (key === 'record_count') {
    return `Model evaluated ${snapshot.record_count} report${snapshot.record_count === 1 ? '' : 's'} with extracted values.`;
  }
  return formatFeatureValue(key, snapshot[key]);
}

function getNormalizedValue(model: Extract<ModelArtifact, { model_type: 'logistic_regression' }>, key: FeatureKey, snapshot: FeatureSnapshot) {
  return (snapshot[key] - model.means[key]) / model.scales[key];
}

function scoreLogisticModel(model: Extract<ModelArtifact, { model_type: 'logistic_regression' }>, snapshot: FeatureSnapshot) {
  const contributions = allFeatures.map((feature) => ({
    key: feature,
    contribution: model.coefficients[feature] * getNormalizedValue(model, feature, snapshot),
  }));

  const linearScore = model.intercept + contributions.reduce((sum, item) => sum + item.contribution, 0);
  const probability = sigmoid(linearScore);
  const factors = contributions
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .map((item) => formatFactor(item.key, snapshot));

  return {
    probability,
    factors,
  };
}

function evaluateXgboostTree(tree: Extract<ModelArtifact, { model_type: 'xgboost' }>['trees'][number], snapshot: FeatureSnapshot) {
  let index = 0;

  while (tree.children_left[index] !== -1) {
    const featureIndex = tree.feature[index];
    const featureName = allFeatures[featureIndex];
    // XGBoost stores split thresholds as float32 internally. Comparing in
    // full float64 precision can put a feature value on the wrong side of
    // a split when it's extremely close to (or exactly at) the boundary -
    // verified empirically against real sklearn/xgboost output during
    // training (see the comment in scripts/train_risk_models.py's
    // serialize_xgboost). Math.fround rounds both operands to float32 to
    // match XGBoost's actual comparison precision.
    const featureValue = Math.fround(snapshot[featureName]);
    const threshold = Math.fround(tree.threshold[index]);
    index = featureValue < threshold ? tree.children_left[index] : tree.children_right[index];
  }

  return tree.leaf_value[index];
}

function scoreXgboostModel(model: Extract<ModelArtifact, { model_type: 'xgboost' }>, snapshot: FeatureSnapshot) {
  // base_score is fixed to 0.5 (logit 0) at training time, so the raw
  // probability is simply sigmoid(sum of leaf margins) with no separate
  // base-margin term - see candidate_models() in train_risk_models.py.
  const margin = model.trees.reduce((sum, tree) => sum + evaluateXgboostTree(tree, snapshot), 0);
  const probability = sigmoid(margin);

  const factors = shapInformedFactors(model.shap_importance, snapshot);

  return { probability, factors };
}

/**
 * Per-instance factor selection for tree-based models (random_forest,
 * xgboost), used because exactly reproducing SHAP's TreeExplainer
 * algorithm in a hand-written TS interpreter (to run without a Python
 * backend at inference time) would be substantial additional surface area
 * we can't verify here without a way to cross-check it numerically at
 * runtime. Instead: each feature's contribution is approximated as its
 * real SHAP-derived global importance (computed in Python during training,
 * via the actual `shap` library - see compute_shap_importance in
 * scripts/train_risk_models.py) weighted by how far this specific
 * patient's value deviates from the training population's mean, in
 * standard-deviation units. A feature that is both influential overall AND
 * unusual for this patient surfaces as a top factor; this is a documented
 * approximation of true per-instance SHAP, not a re-implementation of it.
 */
function shapInformedFactors(shapImportance: Partial<Record<FeatureKey, number>>, snapshot: FeatureSnapshot) {
  const scored = Object.entries(shapImportance).map(([key, importance]) => {
    const featureKey = key as FeatureKey;
    const mean = featureBaseline.mean[featureKey] ?? 0;
    const std = featureBaseline.std[featureKey] ?? 1;
    const zScore = (snapshot[featureKey] - mean) / (std || 1);
    return { key: featureKey, score: Math.abs(importance * zScore) };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => formatFactor(item.key, snapshot));
}

function evaluateTree(tree: Extract<ModelArtifact, { model_type: 'random_forest' }>['trees'][number], snapshot: FeatureSnapshot) {
  let index = 0;

  while (tree.children_left[index] !== -1 && tree.children_right[index] !== -1) {
    const featureIndex = tree.feature[index];
    const featureName = allFeatures[featureIndex];
    const featureValue = snapshot[featureName];
    index = featureValue <= tree.threshold[index] ? tree.children_left[index] : tree.children_right[index];
  }

  return tree.positive_probability[index];
}

function scoreRandomForestModel(model: Extract<ModelArtifact, { model_type: 'random_forest' }>, snapshot: FeatureSnapshot) {
  const probability =
    model.trees.reduce((sum, tree) => sum + evaluateTree(tree, snapshot), 0) / Math.max(model.trees.length, 1);

  const factors = shapInformedFactors(model.shap_importance, snapshot);

  return {
    probability,
    factors,
  };
}

function applyCalibration(rawProbability: number, calibration: { coefficient: number; intercept: number } | undefined) {
  if (!calibration) return rawProbability;
  return sigmoid(calibration.coefficient * rawProbability + calibration.intercept);
}

function scoreModel(modelKey: ModelKey, snapshot: FeatureSnapshot): HealthRiskPrediction {
  const artifact = modelArtifacts[modelKey];
  const result =
    artifact.model_type === 'logistic_regression'
      ? scoreLogisticModel(artifact, snapshot)
      : artifact.model_type === 'xgboost'
        ? scoreXgboostModel(artifact, snapshot)
        : scoreRandomForestModel(artifact, snapshot);

  const calibratedProbability = applyCalibration(result.probability, artifact.calibration);
  const risk = toRiskLevel(calibratedProbability, artifact.threshold);

  return {
    condition: artifact.condition,
    risk,
    probability: Math.round(calibratedProbability * 100),
    factors: result.factors,
    recommendation: artifact.recommendation,
    method: 'trained_model',
    modelVersion: MODEL_VERSION,
  };
}

export function predictHealthRisksFromSnapshot(snapshot: FeatureSnapshot) {
  const predictions = (Object.keys(modelArtifacts) as ModelKey[]).map((modelKey) => scoreModel(modelKey, snapshot));
  return predictions.sort((a, b) => b.probability - a.probability);
}

export function predictHealthRisksFromRecords(records: RecordLike[]) {
  return predictHealthRisksFromSnapshot(buildFeatureSnapshot(records));
}
