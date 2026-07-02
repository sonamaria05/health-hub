import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MedicalRecord, mockRecords } from './mockData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { buildRecordSummary, deriveRecordStatus } from './recordUtils';

const demoDataEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

interface RecordsContextType {
  records: MedicalRecord[];
  isDemoData: boolean;
  addRecord: (record: MedicalRecord) => Promise<void>;
  updateRecord: (id: string, updates: Partial<MedicalRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

function normalizeRecord(record: any): MedicalRecord {
  return {
    id: record.id,
    type: record.type as MedicalRecord['type'],
    title: record.title,
    date: record.date,
    doctor: record.doctor,
    hospital: record.hospital,
    patientName: record.patient_name ?? undefined,
    status: record.status as MedicalRecord['status'],
    extractedData: record.extracted_data ?? undefined,
    fileName: record.file_name,
    filePath: record.file_path ?? undefined,
    amount: record.amount ? Number(record.amount) : undefined,
    summary: record.summary ?? undefined,
    notes: record.notes ?? undefined,
    processingStatus: record.processing_status ?? undefined,
    reviewedAt: record.reviewed_at ?? undefined,
  };
}

function buildPersistedRecord(record: MedicalRecord, userId: string) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    date: record.date,
    doctor: record.doctor,
    hospital: record.hospital,
    patient_name: record.patientName || null,
    status: record.status,
    extracted_data: record.extractedData || null,
    file_name: record.fileName,
    file_path: record.filePath || null,
    amount: record.amount || null,
    summary: record.summary || buildRecordSummary(record),
    notes: record.notes || null,
    processing_status: record.processingStatus || 'processed',
    reviewed_at: record.reviewedAt || null,
    user_id: userId,
  };
}

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [dbRecords, setDbRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRecords = useCallback(async () => {
    if (!user) {
      setDbRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbRecords((data ?? []).map(normalizeRecord));
    } catch (err) {
      console.error('Error fetching records:', err);
      setDbRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const addRecord = useCallback(async (record: MedicalRecord) => {
    if (!user) {
      throw new Error('You must be signed in to save a record.');
    }

    const normalizedRecord: MedicalRecord = {
      ...record,
      status: record.status || deriveRecordStatus(record.extractedData),
      summary: record.summary || buildRecordSummary(record),
      processingStatus: record.processingStatus || 'processed',
    };

    setDbRecords(prev => [normalizedRecord, ...prev]);

    try {
      const { error } = await supabase.from('medical_records').insert(buildPersistedRecord(normalizedRecord, user.id));
      if (error) throw error;

      if (normalizedRecord.extractedData) {
        const features: Record<string, number> = {};
        for (const [key, data] of Object.entries(normalizedRecord.extractedData)) {
          features[key] = data.value;
          features[`${key}_status`] = data.status === 'normal' ? 0 : data.status === 'high' ? 1 : -1;
        }

        const labels = {
          is_attention: normalizedRecord.status === 'attention' ? 1 : 0,
          is_critical: normalizedRecord.status === 'critical' ? 1 : 0,
        };

        const { error: trainingError } = await supabase.from('ml_training_datasets').insert({
          record_id: normalizedRecord.id,
          features,
          labels,
          model_type: 'health_risk',
          user_id: user.id,
        });

        if (trainingError) {
          console.error('Error saving training data:', trainingError);
        }
      }
    } catch (err) {
      console.error('Error saving record:', err);
      setDbRecords(prev => prev.filter(existing => existing.id !== normalizedRecord.id));
      throw err;
    }
  }, [user]);

  const updateRecord = useCallback(async (id: string, updates: Partial<MedicalRecord>) => {
    if (!user) {
      throw new Error('You must be signed in to update a record.');
    }

    const existingRecord = dbRecords.find(record => record.id === id);
    if (!existingRecord) {
      throw new Error('Record not found.');
    }

    const nextRecord: MedicalRecord = {
      ...existingRecord,
      ...updates,
    };

    nextRecord.status = deriveRecordStatus(nextRecord.extractedData);
    nextRecord.summary = nextRecord.summary || buildRecordSummary(nextRecord);
    nextRecord.processingStatus = nextRecord.processingStatus || 'processed';
    nextRecord.reviewedAt = new Date().toISOString();

    setDbRecords(prev => prev.map(record => (record.id === id ? nextRecord : record)));

    try {
      const { error } = await supabase
        .from('medical_records')
        .update(buildPersistedRecord(nextRecord, user.id))
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating record:', err);
      setDbRecords(prev => prev.map(record => (record.id === id ? existingRecord : record)));
      throw err;
    }
  }, [dbRecords, user]);

  const deleteRecord = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('You must be signed in to delete a record.');
    }

    const previousRecords = dbRecords;
    setDbRecords(prev => prev.filter(record => record.id !== id));

    try {
      const { error } = await supabase
        .from('medical_records')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      const record = previousRecords.find(item => item.id === id);
      if (record?.filePath) {
        const { error: storageError } = await supabase.storage
          .from('medical-reports')
          .remove([record.filePath]);
        if (storageError) {
          console.error('Error deleting storage object:', storageError);
        }
      }
    } catch (err) {
      console.error('Error deleting record:', err);
      setDbRecords(previousRecords);
      throw err;
    }
  }, [dbRecords, user]);

  const isDemoData = demoDataEnabled && dbRecords.length === 0;
  const records = isDemoData ? mockRecords : dbRecords;

  return (
    <RecordsContext.Provider value={{ records, isDemoData, addRecord, updateRecord, deleteRecord, loading, refetch: fetchRecords }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecords() {
  const context = useContext(RecordsContext);
  if (!context) throw new Error('useRecords must be used within RecordsProvider');
  return context;
}
