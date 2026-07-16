import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errorUtils';
import { supabase } from '@/integrations/supabase/client';
import type { MedicalRecord } from '@/lib/mockData';
import type { HealthRiskPrediction, RiskLevel } from '@/lib/mlRisk';
import RecordCard from '@/components/RecordCard';
import { useMotionPreset } from '@/lib/motion';

const riskStyles: Record<RiskLevel, { bg: string; text: string; border: string; icon: typeof CheckCircle }> = {
  low: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', icon: CheckCircle },
  moderate: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', icon: AlertTriangle },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', icon: AlertTriangle },
};

export interface ReviewRecord {
  condition: string;
  action: 'confirmed' | 'overridden';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientUserId: string;
  records: MedicalRecord[];
  predictions: HealthRiskPrediction[];
  reviewedConditions: Record<string, ReviewRecord>;
  onReviewed: (condition: string, record: ReviewRecord) => void;
}

export default function PatientReviewDialog({
  open, onOpenChange, patientName, patientUserId, records, predictions, reviewedConditions, onReviewed,
}: Props) {
  const [overridingCondition, setOverridingCondition] = useState<string | null>(null);
  const [overrideLevel, setOverrideLevel] = useState<RiskLevel>('moderate');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { toast } = useToast();
  const { fadeIn } = useMotionPreset();

  const initials = patientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const submitReview = async (
    prediction: HealthRiskPrediction,
    action: 'confirmed' | 'overridden',
    overrideRiskLevel?: RiskLevel,
  ) => {
    setSubmitting(prediction.condition);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const reviewerId = userData.user?.id;
      if (!reviewerId) throw new Error('Not signed in');

      const { error } = await supabase.from('prediction_reviews').insert({
        patient_user_id: patientUserId,
        condition: prediction.condition,
        original_risk_level: prediction.risk,
        original_probability: prediction.probability,
        action,
        override_risk_level: action === 'overridden' ? overrideRiskLevel : null,
        note: note.trim() || null,
        reviewed_by: reviewerId,
      });
      if (error) throw error;

      onReviewed(prediction.condition, { condition: prediction.condition, action });
      toast({
        title: action === 'confirmed' ? 'Prediction confirmed' : 'Prediction overridden',
        description: `${prediction.condition} for ${patientName} has been reviewed.`,
      });
      setOverridingCondition(null);
      setNote('');
    } catch (error: unknown) {
      toast({
        title: 'Could not save review',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="font-heading">{patientName}</DialogTitle>
              <DialogDescription>{records.length} record{records.length === 1 ? '' : 's'} on file</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Risk predictions</h3>
          {predictions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No extracted lab data available yet to generate predictions.</p>
          ) : (
            predictions.map((prediction) => {
              const style = riskStyles[prediction.risk];
              const RiskIcon = style.icon;
              const reviewed = reviewedConditions[prediction.condition];
              const isOverridingThis = overridingCondition === prediction.condition;

              return (
                <motion.div
                  key={prediction.condition}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <RiskIcon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} />
                      <div>
                        <p className="text-sm font-semibold">{prediction.condition}</p>
                        <p className="text-xs text-muted-foreground">
                          {prediction.probability}% probability &middot; {prediction.risk} risk
                        </p>
                      </div>
                    </div>
                    {reviewed && (
                      <Badge variant="outline" className="gap-1 shrink-0">
                        {reviewed.action === 'confirmed' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {reviewed.action === 'confirmed' ? 'Confirmed' : 'Overridden'}
                      </Badge>
                    )}
                  </div>

                  {!reviewed && (
                    <div className="mt-3">
                      {isOverridingThis ? (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            {(['low', 'moderate', 'high'] as RiskLevel[]).map((level) => (
                              <button
                                key={level}
                                onClick={() => setOverrideLevel(level)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize
                                  ${overrideLevel === level ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            placeholder="Clinical note (optional)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="text-xs min-h-16"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => submitReview(prediction, 'overridden', overrideLevel)}
                              disabled={submitting === prediction.condition}
                            >
                              {submitting === prediction.condition && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                              Save override
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setOverridingCondition(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => submitReview(prediction, 'confirmed')}
                            disabled={submitting === prediction.condition}
                          >
                            {submitting === prediction.condition && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setOverridingCondition(prediction.condition)}>
                            Override
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        <div className="space-y-3 mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Records</h3>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <RecordCard key={record.id} record={record} showDetails />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
