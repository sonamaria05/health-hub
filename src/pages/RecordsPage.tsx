import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { useRecords } from '@/lib/RecordsContext';
import RecordCard from '@/components/RecordCard';
import { MedicalRecord, typeLabels } from '@/lib/mockData';
import { Search, Loader2, Download } from 'lucide-react';
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

  const handleExportCSV = () => {
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ['Title', 'Type', 'Date Taken', 'Doctor', 'Hospital', 'Patient', 'Status', 'Summary'];
    const metricNames = Array.from(new Set(filtered.flatMap(r => Object.keys(r.extractedData ?? {}))));
    const allHeaders = [...headers, ...metricNames];

    const rows = filtered.map(r => {
      const base = [
        r.title, r.type, r.date, r.doctor, r.hospital,
        r.patientName ?? '', r.status ?? '', r.summary ?? '',
      ];
      const metrics = metricNames.map(name => {
        const m = r.extractedData?.[name];
        return m ? `${m.value} ${m.unit}` : '';
      });
      return [...base, ...metrics].map(v => escape(String(v))).join(',');
    });

    const csv = [allHeaders.map(h => escape(h)).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `healytics-records-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filtered = records.filter(record => {
    if (filter !== 'all' && record.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = record.title.toLowerCase().includes(q);
      const matchDoctor = record.doctor.toLowerCase().includes(q);
      const matchHospital = (record.hospital || '').toLowerCase().includes(q);
      const matchPatient = (record.patientName || '').toLowerCase().includes(q);
      const matchSummary = (record.summary || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDoctor && !matchHospital && !matchPatient && !matchSummary) {
        return false;
      }
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

      <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
        <h1 className="text-3xl font-bold font-heading text-primary">Patient Medical Summary</h1>
        <p className="text-sm text-muted-foreground mt-2">Generated by Healytics | Date: {new Date().toLocaleDateString()}</p>
        <p className="text-sm mt-4 font-semibold">Total Records Evaluated: {filtered.length}</p>
        <p className="text-xs text-muted-foreground/80 italic mt-1">This document provides a longitudinal overview of extracted biomarkers and active treatments for clinical review.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between print:hidden">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, patient, or doctor..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={filtered.length === 0} className="bg-primary/10 hover:bg-primary/20 text-primary">
            <Download className="w-4 h-4 mr-1.5" />
            Doctor Summary (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap print:hidden">
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
                  <Label htmlFor="edit-date">Date Taken</Label>
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
