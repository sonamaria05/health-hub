import { AlertTriangle, BellRing, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '@/components/StatCard';
import RecordCard from '@/components/RecordCard';
import { StatCardSkeleton, RecordRowSkeleton, CardBlockSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecords } from '@/lib/RecordsContext';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useReminders } from '@/lib/RemindersContext';

export default function DashboardPage() {
  const { records, isDemoData, loading } = useRecords();
  const { profile } = useAuth();
  const { upcomingReminders } = useReminders();
  const firstName = profile?.display_name?.split(' ')[0] || 'there';

  const totalRecords = records.length;
  const attentionItems = records.filter(record => record.status !== 'normal').length;
  const totalBills = records.filter(record => record.type === 'bill').reduce((sum, record) => sum + (record.amount || 0), 0);
  const recentRecords = records.slice(0, 5);

  const recordsWithData = records.filter(record => record.extractedData);
  const totalParameters = recordsWithData.reduce((sum, record) => sum + Object.keys(record.extractedData ?? {}).length, 0);
  const normalParameters = recordsWithData.reduce(
    (sum, record) => sum + Object.values(record.extractedData ?? {}).filter(item => item.status === 'normal').length,
    0,
  );
  const healthScore = totalParameters > 0 ? Math.round((normalParameters / totalParameters) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => <RecordRowSkeleton key={i} />)}
          </div>
          <CardBlockSkeleton lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground mt-1">Here is your current record and health summary.</p>
        {isDemoData && (
          <div className="mt-3">
            <Badge variant="secondary">Demo Data</Badge>
            <p className="text-xs text-muted-foreground mt-2">These sample records are shown because no saved records are available yet.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Records" value={totalRecords} subtitle="Saved medical documents" icon={FileText} variant="primary" />
        <StatCard title="Needs Attention" value={attentionItems} subtitle="Records with abnormal values" icon={AlertTriangle} variant={attentionItems > 0 ? 'warning' : 'success'} />
        <StatCard title="Health Score" value={totalParameters > 0 ? `${healthScore}/100` : 'N/A'} subtitle="Based on extracted parameters" icon={TrendingUp} variant={healthScore >= 70 ? 'success' : 'warning'} />
        <StatCard title="Total Bills" value={`Rs. ${totalBills.toLocaleString()}`} subtitle="Tracked medical expenses" icon={DollarSign} />
      </div>

      <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg">Recent Records</h2>
            <Link to="/records" className="text-sm text-primary font-medium hover:underline">View all</Link>
          </div>
          <div className="grid gap-3">
            {recentRecords.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                <p className="font-heading font-semibold text-foreground">No records yet</p>
                <p className="text-sm mt-2">Upload your first report to start building analytics and insights.</p>
              </div>
            ) : (
              recentRecords.map(record => (
                <RecordCard key={record.id} record={record} showDetails />
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-heading font-semibold text-lg">Project Health</h2>
            <p className="text-sm text-muted-foreground mt-1">What this version now supports.</p>
          </div>
          <ul className="space-y-3 text-sm">
            <li>Private storage access for report files through signed URLs.</li>
            <li>Editable records with summaries, notes, patient names, and review status.</li>
            <li>Rule-based health insights and analytics from actual uploaded data.</li>
            <li>Email verification reminders and profile settings for production readiness.</li>
          </ul>
          <div className="pt-2 flex gap-3">
            <Link to="/upload" className="text-sm text-primary font-medium hover:underline">Upload a report</Link>
            <Link to="/settings" className="text-sm text-primary font-medium hover:underline">Open settings</Link>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-heading font-semibold text-lg">Reminders</h2>
            <p className="text-sm text-muted-foreground">Upcoming health follow-ups and medication reminders.</p>
          </div>
        </div>
        {upcomingReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders scheduled yet. Add them from settings.</p>
        ) : (
          <div className="grid gap-3">
            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className="rounded-xl border border-border bg-background p-4">
                <p className="font-medium text-sm">{reminder.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(reminder.scheduledFor).toLocaleString()}</p>
                {reminder.notes && <p className="text-xs text-muted-foreground mt-2">{reminder.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
