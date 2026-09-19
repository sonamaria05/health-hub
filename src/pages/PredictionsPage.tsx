import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Brain, CheckCircle, Info, TrendingUp } from 'lucide-react';
import { useRecords } from '@/lib/RecordsContext';
import { buildFeatureSnapshot, HealthRiskPrediction, predictHealthRisksFromRecords } from '@/lib/mlRisk';
import { Skeleton } from '@/components/ui/skeleton';
import { RiskCardSkeleton } from '@/components/skeletons/PageSkeletons';
import { Badge } from '@/components/ui/badge';
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
  const localPredictions = useMemo(() => predictHealthRisksFromRecords(records), [records]);
  const recordsWithData = records.filter(record => record.extractedData);
  const [predictions, setPredictions] = useState<HealthRiskPrediction[]>([]);
  const [modelSource, setModelSource] = useState<'backend_model' | 'local_model'>('local_model');
  const [predictionLoading, setPredictionLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Health Insights</h1>
        <p className="text-muted-foreground mt-1">Model-based guidance generated from {recordsWithData.length} reports with extracted health data.</p>
        {isDemoData && (
          <div className="mt-3">
            <Badge variant="secondary">Demo Data</Badge>
          </div>
        )}
        <div className="mt-3">
          <Badge variant="outline">{modelSource === 'backend_model' ? 'Backend Model' : 'Local Model Fallback'}</Badge>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex gap-4">
        <Brain className="w-8 h-8 text-primary shrink-0 mt-1" />
        <div>
          <h2 className="font-heading font-semibold text-sm">How Insights Work</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            These predictions use trained tabular models over your latest extracted lab markers, engineered trend signals, and record patterns. They help highlight follow-up areas, but they are not a diagnosis and should not replace professional medical advice.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Average Accuracy</p>
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

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-heading font-semibold text-sm">Model Evaluation</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Trained on {mlMetrics.dataset.seed_rows} total rows with {mlMetrics.dataset.train_rows} train samples and {mlMetrics.dataset.test_rows} held-out test samples.
        </p>
        <div className="mt-4 grid gap-3">
          {Object.entries(mlMetrics.per_model).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-medium text-sm">
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

      {predictions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <p className="font-heading font-semibold text-foreground">No predictions available yet</p>
          <p className="text-sm mt-2">Upload blood tests or reports with extracted lab values to generate model predictions here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {predictions.map((insight, index) => {
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
                            <span className="text-muted-foreground mt-0.5">*</span> {factor}
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

      <p className="text-[10px] text-muted-foreground text-center px-4">
        These model predictions are informational and should be reviewed alongside your clinician, not used as a medical diagnosis.
      </p>
    </div>
  );
}
