import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { useRecords } from '@/lib/RecordsContext';
import RecordCard from '@/components/RecordCard';
import { MedicalRecord, typeLabels } from '@/lib/mockData';
import { Search, Loader2 } from 'lucide-react';
import { RecordRowSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const filterTypes = ['all', 'blood_test', 'prescription', 'imaging', 'bill', 'discharge_summary'] as const;

export default function RecordsPage() {
  const { records, isDemoData, updateRecord, deleteRecord, loading } = useRecords();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [draftRecord, setDraftRecord] = useState<MedicalRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDraftRecord(editingRecord);
  }, [editingRecord]);

  const handleDelete = async (id: string) => {
    try {
      await deleteRecord(id);
      toast({ title: 'Record deleted', description: 'The record has been removed.' });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: getErrorMessage(err, 'We could not delete this record. Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !draftRecord) return;

    setSaving(true);
    try {
      await updateRecord(editingRecord.id, draftRecord);
      toast({ title: 'Record updated', description: 'Your changes were saved.' });
      setEditingRecord(null);
      setDraftRecord(null);
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: getErrorMessage(err, 'We could not save your changes.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = records.filter(record => {
    if (filter !== 'all' && record.type !== filter) return false;
    if (
      search &&
      !record.title.toLowerCase().includes(search.toLowerCase()) &&
      !record.doctor.toLowerCase().includes(search.toLowerCase()) &&
      !(record.patientName || '').toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading records">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => <RecordRowSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Medical Records</h1>
        <p className="text-muted-foreground mt-1">{records.length} records stored securely.</p>
        {isDemoData && (
          <div className="mt-3">
            <Badge variant="secondary">Demo Data</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, patient, or doctor..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${filter === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {type === 'all' ? 'All' : typeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-heading font-semibold">No records found</p>
            <p className="text-sm mt-1">Try adjusting your filters or upload a new report.</p>
          </div>
        ) : (
          filtered.map(record => (
            <RecordCard
              key={record.id}
              record={record}
              showDetails
              onDelete={handleDelete}
              onEdit={setEditingRecord}
            />
          ))
        )}
      </div>

      <Dialog open={Boolean(editingRecord)} onOpenChange={open => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>Update the key details for this saved record.</DialogDescription>
          </DialogHeader>

          {draftRecord && (
            <div className="grid gap-4 py-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input id="edit-title" value={draftRecord.title} onChange={event => setDraftRecord(prev => prev ? { ...prev, title: event.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-patient">Patient Name</Label>
                  <Input id="edit-patient" value={draftRecord.patientName || ''} onChange={event => setDraftRecord(prev => prev ? { ...prev, patientName: event.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input id="edit-date" type="date" value={draftRecord.date} onChange={event => setDraftRecord(prev => prev ? { ...prev, date: event.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <select
                    id="edit-type"
                    value={draftRecord.type}
                    onChange={event => setDraftRecord(prev => prev ? { ...prev, type: event.target.value as MedicalRecord['type'] } : prev)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-doctor">Doctor</Label>
                  <Input id="edit-doctor" value={draftRecord.doctor} onChange={event => setDraftRecord(prev => prev ? { ...prev, doctor: event.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-hospital">Hospital or Lab</Label>
                  <Input id="edit-hospital" value={draftRecord.hospital} onChange={event => setDraftRecord(prev => prev ? { ...prev, hospital: event.target.value } : prev)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-summary">Summary</Label>
                <Textarea id="edit-summary" value={draftRecord.summary || ''} onChange={event => setDraftRecord(prev => prev ? { ...prev, summary: event.target.value } : prev)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea id="edit-notes" value={draftRecord.notes || ''} onChange={event => setDraftRecord(prev => prev ? { ...prev, notes: event.target.value } : prev)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="gradient-primary text-primary-foreground border-0" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
