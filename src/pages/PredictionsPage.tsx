import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Brain, CheckCircle, Info, Sliders, Sparkles, TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';
import { useRecords } from '@/lib/RecordsContext';
import {
  buildFeatureSnapshot,
  deriveEngineeredFeatures,
  FeatureSnapshot,
  HealthRiskPrediction,
  predictHealthRisksFromRecords,
  predictHealthRisksFromSnapshot,
} from '@/lib/mlRisk';
import { generateTrendAlerts } from '@/lib/healthInsights';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskCardSkeleton } from '@/components/skeletons/PageSkeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { mlMetrics } from '@/lib/generated/mlMetrics';
import RiskGauge from '@/components/RiskGauge';
import { useMotionPreset } from '@/lib/motion';

const riskStyles = {
  low: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', icon: CheckCircle },
  moderate: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', icon: AlertTriangle },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', icon: AlertTriangle },
};

export default function PredictionsPage() {
  const { fadeInUp } = useMotionPreset();
  const { records, isDemoData, loading } = useRecords();
  const baselineSnapshot = useMemo(() => buildFeatureSnapshot(records), [records]);
  const localPredictions = useMemo(() => predictHealthRisksFromRecords(records), [records]);
  const trendAlerts = useMemo(() => generateTrendAlerts(records), [records]);
  const recordsWithData = records.filter(record => record.extractedData);
  const [predictions, setPredictions] = useState<HealthRiskPrediction[]>([]);
  const [modelSource, setModelSource] = useState<'backend_model' | 'local_model'>('local_model');
  const [predictionLoading, setPredictionLoading] = useState(true);

  // What-If Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simGlucose, setSimGlucose] = useState(baselineSnapshot.fasting_glucose || 95);
  const [simHba1c, setSimHba1c] = useState(baselineSnapshot.hba1c || 5.4);
  const [simHemoglobin, setSimHemoglobin] = useState(baselineSnapshot.hemoglobin || 14.0);
  const [simCholesterol, setSimCholesterol] = useState(baselineSnapshot.total_cholesterol || 185);
  const [simCreatinine, setSimCreatinine] = useState(baselineSnapshot.creatinine || 0.9);

  useEffect(() => {
    setSimGlucose(baselineSnapshot.fasting_glucose || 95);
    setSimHba1c(baselineSnapshot.hba1c || 5.4);
    setSimHemoglobin(baselineSnapshot.hemoglobin || 14.0);
    setSimCholesterol(baselineSnapshot.total_cholesterol || 185);
    setSimCreatinine(baselineSnapshot.creatinine || 0.9);
  }, [baselineSnapshot]);

  const simulatedPredictions = useMemo(() => {
    const rawBase = {
      hemoglobin: simHemoglobin,
      fasting_glucose: simGlucose,
      total_cholesterol: simCholesterol,
      creatinine: simCreatinine,
      hba1c: simHba1c,
      ldl_cholesterol: baselineSnapshot.ldl_cholesterol || 100,
      triglycerides: baselineSnapshot.triglycerides || 130,
      abnormal_ratio: baselineSnapshot.abnormal_ratio || 0,
      record_count: baselineSnapshot.record_count || 1,
    };
    const engineered = deriveEngineeredFeatures(rawBase);
    const snapshot: FeatureSnapshot = { ...rawBase, ...engineered };
    return predictHealthRisksFromSnapshot(snapshot);
  }, [baselineSnapshot, simCholesterol, simCreatinine, simGlucose, simHba1c, simHemoglobin]);

  useEffect(() => {
    if (recordsWithData.length === 0) {
      setPredictions([]);
      setModelSource('local_model');
      setPredictionLoading(false);
      return;
    }

    let ignore = false;

    const loadPredictions = async () => {
      setPredictionLoading(true);

      try {
        const featureSnapshot = buildFeatureSnapshot(records);
        const { data, error } = await supabase.functions.invoke('predict-health-risks', {
          body: { featureSnapshot },
        });

        if (error) throw error;
        if (!ignore && Array.isArray(data?.predictions)) {
          setPredictions(data.predictions as HealthRiskPrediction[]);
          setModelSource(data?.source === 'backend_model' ? 'backend_model' : 'local_model');
          setPredictionLoading(false);
          return;
        }
      } catch (error) {
        console.error('Predict-health-risks fallback:', error);
      }

      if (!ignore) {
        setPredictions(localPredictions);
        setModelSource('local_model');
        setPredictionLoading(false);
      }
    };

    void loadPredictions();

    return () => {
      ignore = true;
    };
  }, [localPredictions, records, recordsWithData.length]);

  if (loading || predictionLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading health insights">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <RiskCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const activePredictions = showSimulator ? simulatedPredictions : predictions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Health Insights</h1>
          <p className="text-muted-foreground mt-1">Model-based risk predictions generated from {recordsWithData.length} records with extracted lab data.</p>
          <div className="flex gap-2 mt-2">
            {isDemoData && <Badge variant="secondary">Demo Data</Badge>}
            <Badge variant="outline">{modelSource === 'backend_model' ? 'Backend Model' : 'Local Model Fallback'}</Badge>
            {showSimulator && <Badge className="bg-primary text-primary-foreground">Interactive Simulation Active</Badge>}
          </div>
        </div>

        <Button
          onClick={() => setShowSimulator(!showSimulator)}
          variant={showSimulator ? 'default' : 'outline'}
          className="gap-2 text-xs"
        >
          <Sliders className="w-4 h-4" />
          {showSimulator ? 'Close Simulator' : 'What-If Biomarker Simulator'}
        </Button>
      </div>

      {showSimulator && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-heading font-semibold text-sm">Interactive Biomarker Risk Simulator</h3>
                <p className="text-xs text-muted-foreground">Adjust target lab values below to simulate how lifestyle or treatment changes impact predicted risk.</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSimGlucose(baselineSnapshot.fasting_glucose || 95);
                setSimHba1c(baselineSnapshot.hba1c || 5.4);
                setSimHemoglobin(baselineSnapshot.hemoglobin || 14.0);
                setSimCholesterol(baselineSnapshot.total_cholesterol || 185);
                setSimCreatinine(baselineSnapshot.creatinine || 0.9);
              }}
              className="text-xs gap-1.5 h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset to Baseline
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fasting Glucose</span>
                <span className="font-bold text-primary">{simGlucose} mg/dL</span>
              </div>
              <input
                type="range"
                min="60"
                max="250"
                step="1"
                value={simGlucose}
                onChange={(e) => setSimGlucose(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Normal: 70–100</p>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">HbA1c</span>
                <span className="font-bold text-primary">{simHba1c.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="12.0"
                step="0.1"
                value={simHba1c}
                onChange={(e) => setSimHba1c(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Normal: &lt; 5.7%</p>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Hemoglobin</span>
                <span className="font-bold text-primary">{simHemoglobin.toFixed(1)} g/dL</span>
              </div>
              <input
                type="range"
                min="8.0"
                max="18.0"
                step="0.1"
                value={simHemoglobin}
                onChange={(e) => setSimHemoglobin(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Normal: 12–16</p>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Cholesterol</span>
                <span className="font-bold text-primary">{simCholesterol} mg/dL</span>
              </div>
              <input
                type="range"
                min="120"
                max="320"
                step="1"
                value={simCholesterol}
                onChange={(e) => setSimCholesterol(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Normal: &lt; 200</p>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Creatinine</span>
                <span className="font-bold text-primary">{simCreatinine.toFixed(2)} mg/dL</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.05"
                value={simCreatinine}
                onChange={(e) => setSimCreatinine(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Normal: 0.6–1.2</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex gap-4 print:hidden">
        <Brain className="w-8 h-8 text-primary shrink-0 mt-1" />
        <div>
          <h2 className="font-heading font-semibold text-sm">How Insights Work</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            These predictions use XGBoost models trained on <strong>real patient data</strong> from the MIMIC-IV Clinical Database.
            Rule-based insights (anemia, thyroid, glycaemic) follow WHO, ADA 2024, AHA/ACC 2019, and AACE guidelines.
            Results are <strong>screening indicators only</strong> — not a diagnosis. Always confirm with a licensed clinician.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Avg. Accuracy (synthetic test set)</p>
          <p className="text-2xl font-heading font-bold mt-1">{Math.round(mlMetrics.summary.average_accuracy * 100)}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Average F1 Score</p>
          <p className="text-2xl font-heading font-bold mt-1">{mlMetrics.summary.average_f1.toFixed(3)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Average ROC AUC</p>
          <p className="text-2xl font-heading font-bold mt-1">{mlMetrics.summary.average_auc.toFixed(3)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 print:hidden">
        <h2 className="font-heading font-semibold text-sm">Model Evaluation</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Trained on <strong>{mlMetrics.dataset.seed_rows} real patient encounters</strong> from the MIMIC-IV ICU dataset (augmented {mlMetrics.dataset.augmentation_factor}× to {mlMetrics.dataset.seed_rows * mlMetrics.dataset.augmentation_factor} rows via Gaussian noise) using a {Math.round((1 - mlMetrics.dataset.test_ratio) * 100)}/{Math.round(mlMetrics.dataset.test_ratio * 100)} train/test split.
          Labels derived from WHO/ADA/AHA clinical thresholds applied to lab values.
        </p>
        <div className="mt-4 grid gap-3">
          {Object.entries(mlMetrics.per_model).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-medium text-sm capitalize">
                  {value.selected_model === 'xgboost' ? 'XGBoost' : value.selected_model === 'random_forest' ? 'Random Forest' : 'Logistic Regression'} for {key}
                </p>
                <Badge variant="outline">Threshold {value.test_metrics.threshold}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Accuracy</span><p className="font-semibold mt-1">{(value.test_metrics.accuracy * 100).toFixed(1)}%</p></div>
                <div><span className="text-muted-foreground">Precision</span><p className="font-semibold mt-1">{(value.test_metrics.precision * 100).toFixed(1)}%</p></div>
                <div><span className="text-muted-foreground">Recall</span><p className="font-semibold mt-1">{(value.test_metrics.recall * 100).toFixed(1)}%</p></div>
                <div><span className="text-muted-foreground">F1 / AUC</span><p className="font-semibold mt-1">{value.test_metrics.f1.toFixed(3)} / {value.test_metrics.auc.toFixed(3)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {activePredictions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <p className="font-heading font-semibold text-foreground">No predictions available yet</p>
          <p className="text-sm mt-2">Upload blood tests or reports with extracted lab values to generate model predictions here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          
          {trendAlerts.length > 0 && (
            <div className="space-y-3 mb-2">
              <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Longitudinal Trend Alerts
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {trendAlerts.map((alert, idx) => (
                  <motion.div
                    key={`trend-${idx}`}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: idx * 0.08 }}
                    className={`p-4 rounded-xl border ${
                      alert.status === 'worsening' 
                        ? 'bg-destructive/5 border-destructive/20' 
                        : 'bg-success/5 border-success/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{alert.condition}</p>
                      <Badge variant="outline" className={
                        alert.status === 'worsening' ? 'text-destructive border-destructive' : 'text-success border-success'
                      }>
                        {alert.status === 'worsening' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {alert.velocityStr}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{alert.message}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-heading font-semibold text-lg mt-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> ML Predicted Risks
          </h3>

          {activePredictions.map((insight, index) => {
            const style = riskStyles[insight.risk];

            return (
              <motion.div
                key={insight.condition}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.08 }}
                className={`bg-card border rounded-xl p-5 ${style.border}`}
              >
                <div className="flex items-start gap-4">
                  <RiskGauge probability={insight.probability} risk={insight.risk} delay={index * 0.08} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-heading font-bold">{insight.condition}</h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {insight.risk} risk
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Contributing Factors
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {insight.factors.map((factor, factorIndex) => (
                          <li key={factorIndex} className="text-xs text-foreground flex items-start gap-2">
                            <span className="text-muted-foreground mt-0.5">•</span> {factor}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-muted/50 flex gap-2">
                      <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center px-4 print:hidden">
        ⚕ These model predictions and rule-based insights are for <strong>informational and screening purposes only</strong>.
        They do not constitute a medical diagnosis.
        Thresholds follow WHO, ADA 2024, AHA/ACC 2019, and AACE guidelines.
        Always consult a licensed healthcare professional before acting on any result.
      </p>

    </div>
  );
}
