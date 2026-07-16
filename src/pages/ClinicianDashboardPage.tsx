import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeRecord } from '@/lib/RecordsContext';
import { predictHealthRisksFromRecords, type HealthRiskPrediction } from '@/lib/mlRisk';
import type { MedicalRecord } from '@/lib/mockData';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMotionPreset } from '@/lib/motion';
import PatientReviewDialog, { type ReviewRecord } from '@/components/PatientReviewDialog';

interface PatientSummary {
  userId: string;
  displayName: string;
  records: MedicalRecord[];
  predictions: HealthRiskPrediction[];
  reviewedConditions: Record<string, ReviewRecord>;
}

type StatusFilter = 'all' | 'needs_review' | 'reviewed' | 'no_flags';

function patientStatus(patient: PatientSummary): StatusFilter {
  const flagged = patient.predictions.filter(p => p.risk !== 'low');
  if (flagged.length === 0) return 'no_flags';
  const allReviewed = flagged.every(p => patient.reviewedConditions[p.condition]);
  return allReviewed ? 'reviewed' : 'needs_review';
}

export default function ClinicianDashboardPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const { fadeInUp, staggerContainer } = useMotionPreset();

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: profileRows, error: profileError }, { data: recordRows, error: recordError }, { data: reviewRows, error: reviewError }] =
          await Promise.all([
            supabase.from('profiles').select('user_id, display_name').eq('role', 'patient'),
            supabase.from('medical_records').select('*'),
            supabase.from('prediction_reviews').select('patient_user_id, condition, action').order('created_at', { ascending: false }),
          ]);

        if (profileError) throw profileError;
        if (recordError) throw recordError;
        if (reviewError) throw reviewError;

        const recordsByPatient = new Map<string, MedicalRecord[]>();
        for (const row of recordRows ?? []) {
          const list = recordsByPatient.get(row.user_id) ?? [];
          list.push(normalizeRecord(row));
          recordsByPatient.set(row.user_id, list);
        }

        // Reviews are ordered newest-first above, so the first one seen per
        // (patient, condition) pair is the latest - later duplicates are ignored.
        const reviewsByPatient = new Map<string, Record<string, ReviewRecord>>();
        for (const row of reviewRows ?? []) {
          const existing = reviewsByPatient.get(row.patient_user_id) ?? {};
          if (!existing[row.condition]) {
            existing[row.condition] = { condition: row.condition, action: row.action as ReviewRecord['action'] };
          }
          reviewsByPatient.set(row.patient_user_id, existing);
        }

        const summaries: PatientSummary[] = (profileRows ?? []).map((profile) => {
          const records = recordsByPatient.get(profile.user_id) ?? [];
          return {
            userId: profile.user_id,
            displayName: profile.display_name || 'Unnamed Patient',
            records,
            predictions: predictHealthRisksFromRecords(records),
            reviewedConditions: reviewsByPatient.get(profile.user_id) ?? {},
          };
        });

        if (!ignore) setPatients(summaries);
      } catch (error) {
        console.error('Error loading clinician dashboard:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void load();
    return () => { ignore = true; };
  }, []);

  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => p.displayName.toLowerCase().includes(search.toLowerCase()))
      .filter(p => statusFilter === 'all' || patientStatus(p) === statusFilter)
      .sort((a, b) => {
        const order: Record<StatusFilter, number> = { needs_review: 0, reviewed: 1, no_flags: 2, all: 3 };
        return order[patientStatus(a)] - order[patientStatus(b)];
      });
  }, [patients, search, statusFilter]);

  const needsReviewCount = patients.filter(p => patientStatus(p) === 'needs_review').length;
  const selectedPatient = patients.find(p => p.userId === selectedPatientId) ?? null;

  const handleReviewed = (condition: string, record: ReviewRecord) => {
    setPatients(prev => prev.map(p =>
      p.userId === selectedPatientId
        ? { ...p, reviewedConditions: { ...p.reviewedConditions, [condition]: record } }
        : p
    ));
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading clinician dashboard">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Clinician Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {patients.length} patient{patients.length === 1 ? '' : 's'}
          {needsReviewCount > 0 && (
            <span className="text-warning font-medium"> &middot; {needsReviewCount} awaiting review</span>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patients by name..."
            aria-label="Search patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {([
            ['all', 'All'],
            ['needs_review', 'Needs Review'],
            ['reviewed', 'Reviewed'],
            ['no_flags', 'Stable'],
          ] as [StatusFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors
                ${statusFilter === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No patients match this view</p>
          <p className="text-sm text-muted-foreground mt-1">Try a different search or filter.</p>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
          {filteredPatients.map((patient) => {
            const status = patientStatus(patient);
            const initials = patient.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

            return (
              <motion.button
                key={patient.userId}
                variants={fadeInUp}
                onClick={() => setSelectedPatientId(patient.userId)}
                className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:shadow-sm transition-all text-left"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{patient.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {patient.records.length} record{patient.records.length === 1 ? '' : 's'}
                  </p>
                </div>
                {status === 'needs_review' && (
                  <Badge className="gap-1 bg-warning/10 text-warning border-warning/20 shrink-0">
                    <ShieldAlert className="w-3 h-3" /> Needs Review
                  </Badge>
                )}
                {status === 'reviewed' && (
                  <Badge variant="outline" className="gap-1 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> Reviewed
                  </Badge>
                )}
                {status === 'no_flags' && (
                  <Badge variant="secondary" className="shrink-0">Stable</Badge>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {selectedPatient && (
        <PatientReviewDialog
          open={Boolean(selectedPatient)}
          onOpenChange={(open) => !open && setSelectedPatientId(null)}
          patientName={selectedPatient.displayName}
          patientUserId={selectedPatient.userId}
          records={selectedPatient.records}
          predictions={selectedPatient.predictions}
          reviewedConditions={selectedPatient.reviewedConditions}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  );
}
