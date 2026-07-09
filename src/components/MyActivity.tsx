import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/AuthContext';

interface AuditRow {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  medical_records: 'Medical record',
  ml_training_datasets: 'ML training data',
  profiles: 'Profile',
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
};

export default function MyActivity() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    supabase
      .from('audit_log')
      .select('id, action, table_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (ignore) return;
        if (error) console.error('Error loading activity:', error);
        setRows(data ?? []);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [user]);

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <p className="font-medium text-sm">My Activity</p>
      </div>
      <p className="text-xs text-muted-foreground">
        A read-only record of changes made to your account and medical data. This log cannot
        be edited or deleted by anyone, including administrators.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading activity...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="text-sm flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
              <span>
                {TABLE_LABELS[row.table_name] ?? row.table_name} {ACTION_LABELS[row.action] ?? row.action.toLowerCase()}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(row.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
