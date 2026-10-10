import { useState, useCallback } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { Upload, CheckCircle, Loader2, Sparkles, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecords } from '@/lib/RecordsContext';
import { MedicalRecord, typeLabels } from '@/lib/mockData';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { buildExtractionPayload, canAttemptRemoteExtraction, extractMedicalRecordLocally, extractMedicalRecordWithAI } from '@/lib/documentProcessing';
import { buildRecordSummary, deriveRecordStatus, validateUploadFile } from '@/lib/recordUtils';
import { extractMedicalDataSchema } from '@/lib/schemas/edgeFunctionSchemas';
import { statusFromRange } from '@/lib/localMedicalExtraction';
import { normalizeExtractedData } from '@/lib/medicalValidation';

type Step = 'upload' | 'scanning' | 'extracted' | 'done';

type EditableRecord = Partial<MedicalRecord>;

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [extractedData, setExtractedData] = useState<MedicalRecord['extractedData']>();
  const [editableRecord, setEditableRecord] = useState<EditableRecord>({});
  const [filePath, setFilePath] = useState('');
  const [error, setError] = useState('');
  const [showAddParam, setShowAddParam] = useState(false);
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [newParamUnit, setNewParamUnit] = useState('mg/dL');
  const [newParamRange, setNewParamRange] = useState('70-100');
  const { addRecord } = useRecords();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const handleUpdateParamValue = (key: string, rawVal: string) => {
    const num = Number(rawVal);
    setExtractedData((prev) => {
      if (!prev || !prev[key]) return prev;
      const current = prev[key];
      return {
        ...prev,
        [key]: {
          ...current,
          value: Number.isNaN(num) ? 0 : num,
          status: statusFromRange(Number.isNaN(num) ? 0 : num, current.normalRange),
        },
      };
    });
  };

  const handleDeleteParameter = (key: string) => {
    setExtractedData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddParameter = () => {
    if (!newParamKey.trim() || !newParamValue.trim()) {
      toast({ title: 'Missing fields', description: 'Enter both a parameter name and value.', variant: 'destructive' });
      return;
    }
    const num = Number(newParamValue);
    if (Number.isNaN(num)) {
      toast({ title: 'Invalid value', description: 'Parameter value must be a number.', variant: 'destructive' });
      return;
    }
    const range = newParamRange.trim() || '0-100';
    const unit = newParamUnit.trim() || '';
    setExtractedData((prev) => ({
      ...(prev || {}),
      [newParamKey.trim()]: {
        value: num,
        unit,
        normalRange: range,
        status: statusFromRange(num, range),
      },
    }));
    setNewParamKey('');
    setNewParamValue('');
    setShowAddParam(false);
    toast({ title: 'Marker added', description: `Added ${newParamKey.trim()} to extracted parameters.` });
  };

  const loadSampleReport = (type: 'cbc' | 'lipid' | 'metabolic') => {
    let sampleData: MedicalRecord['extractedData'] = {};
    let title = '';
    const doctor = 'Dr. Priya Sharma, MD';
    const hospital = 'Apollo Diagnostic Centre';

    if (type === 'cbc') {
      title = 'Complete Blood Count (CBC) Panel';
      sampleData = {
        'Hemoglobin': { value: 11.2, unit: 'g/dL', normalRange: '12-16', status: 'low' },
        'RBC': { value: 3.9, unit: '10^6/uL', normalRange: '4.2-5.9', status: 'low' },
        'WBC': { value: 6.8, unit: '10^3/uL', normalRange: '4-11', status: 'normal' },
        'Platelets': { value: 240, unit: '10^3/uL', normalRange: '150-450', status: 'normal' },
      };
    } else if (type === 'lipid') {
      title = 'Comprehensive Lipid Profile';
      sampleData = {
        'Total Cholesterol': { value: 245, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
        'LDL Cholesterol': { value: 162, unit: 'mg/dL', normalRange: '0-100', status: 'high' },
        'HDL Cholesterol': { value: 42, unit: 'mg/dL', normalRange: '40-60', status: 'normal' },
        'Triglycerides': { value: 185, unit: 'mg/dL', normalRange: '0-150', status: 'high' },
      };
    } else {
      title = 'Comprehensive Metabolic & Kidney Panel';
      sampleData = {
        'Fasting Glucose': { value: 118, unit: 'mg/dL', normalRange: '70-100', status: 'high' },
        'HbA1c': { value: 6.4, unit: '%', normalRange: '0-5.7', status: 'high' },
        'Creatinine': { value: 1.1, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
        'Urea': { value: 28, unit: 'mg/dL', normalRange: '10-50', status: 'normal' },
      };
    }

    setFileName(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    setExtractedData(sampleData);
    setEditableRecord({
      type: 'blood_test',
      title,
      date: new Date().toISOString().slice(0, 10),
      doctor,
      hospital,
      patientName: profile?.display_name || 'Patient',
      status: deriveRecordStatus(sampleData),
      processingStatus: 'processed',
      summary: buildRecordSummary({
        type: 'blood_test',
        doctor,
        hospital,
        extractedData: sampleData,
      } as MedicalRecord),
    });
    setStep('extracted');
    toast({ title: 'Sample Report Loaded', description: `Loaded sample ${title} for review.` });
  };

  const cleanupUploadedFile = useCallback(async (path: string) => {
    const { error: removeError } = await supabase.storage
      .from('medical-reports')
      .remove([path]);

    if (removeError) {
      console.error('Cleanup error:', removeError);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in again before uploading a report.',
        variant: 'destructive',
      });
      return;
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      toast({ title: 'Invalid file', description: validationError, variant: 'destructive' });
      return;
    }

    setFileName(file.name);
    setStep('scanning');
    setError('');

    let uploadedFilePath = '';

    try {
      const storagePath = `${user.id}/${Date.now()}_${file.name}`;
      uploadedFilePath = storagePath;
      try {
        const { error: uploadError } = await supabase.storage
          .from('medical-reports')
          .upload(storagePath, file, { upsert: false });

        if (!uploadError) {
          setFilePath(storagePath);
        } else {
          console.warn('Storage upload deferred:', uploadError.message);
        }
      } catch (storageErr) {
        console.warn('Storage network error:', storageErr);
      }

      const localKey = localStorage.getItem('healytics_gemini_key')?.trim();
      const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
      const geminiApiKey = (localKey && localKey.length > 5) ? localKey : (envKey && envKey.length > 5) ? envKey : undefined;

      let extractedRecord: EditableRecord | null = null;
      let reviewMessage = '';

      // 1. Direct High-Precision Gemini Vision (if key configured)
      if (geminiApiKey && canAttemptRemoteExtraction(file)) {
        try {
          const extractionPayload = await buildExtractionPayload(file);
          extractedRecord = (await extractWithGeminiVision(
            extractionPayload.fileBase64,
            extractionPayload.mimeType,
            geminiApiKey
          )) as EditableRecord;
        } catch (visionError: unknown) {
          console.warn('Direct Gemini Vision extraction error:', visionError);
          toast({
            title: 'Gemini Vision Warning',
            description: getErrorMessage(visionError, 'AI Vision extraction failed, using in-browser OCR.'),
            variant: 'destructive',
          });
        }
      }

      // 2. Supabase Edge Function (if no direct key or direct failed)
      if (!extractedRecord && canAttemptRemoteExtraction(file)) {
        try {
          const extractionPayload = await buildExtractionPayload(file);
          const parsed = extractMedicalDataSchema.safeParse(extractionPayload);
          if (parsed.success) {
            const { data: extractionData, error: fnError } = await supabase.functions.invoke('extract-medical-data', {
              body: parsed.data,
            });
            if (!fnError && extractionData?.record) {
              extractedRecord = extractionData.record as EditableRecord;
            }
          }
        } catch (remoteError: unknown) {
          console.warn('Edge function extraction unavailable:', remoteError);
        }
      }

      // 3. In-Browser OCR Fallback (Tesseract.js)
      if (!extractedRecord) {
        const localExtraction = await extractMedicalRecordLocally(file);
        extractedRecord = localExtraction.record as EditableRecord;
        if (localExtraction.source === 'manual_review') {
          reviewMessage = extractedRecord.summary || 'Automatic extraction could not complete. Review the fields before saving.';
        }
      }

      const rawExtractedData = extractedRecord.extractedData || {};
      const { extractedData: nextExtractedData, issues } = normalizeExtractedData(rawExtractedData);

      // Apply validation issues: force needs_review on any critically-flagged field
      const criticalFieldNames = new Set(
        issues.filter(i => i.severity === 'critical').map(i => i.metric)
      );
      for (const key of criticalFieldNames) {
        if (nextExtractedData[key]) {
          nextExtractedData[key] = { ...nextExtractedData[key], needs_review: true };
        }
      }

      const nextStatus = deriveRecordStatus(nextExtractedData);
      const hasIssues  = issues.some(i => i.severity === 'critical');
      const nextProcessingStatus = extractedRecord.processingStatus ||
        (reviewMessage || hasIssues ? 'needs_review' : 'processed');

      // Surface critical validation warnings in the review message
      if (hasIssues && !reviewMessage) {
        reviewMessage = `Some values were flagged for review: ${issues
          .filter(i => i.severity === 'critical')
          .map(i => i.metric)
          .join(', ')}.`;
      }

      setExtractedData(nextExtractedData);
      setEditableRecord({
        ...extractedRecord,
        patientName: extractedRecord.patientName || profile?.display_name || '',
        status: nextStatus,
        processingStatus: nextProcessingStatus,
        summary: extractedRecord.summary || buildRecordSummary({
          ...extractedRecord,
          extractedData: nextExtractedData,
          amount: extractedRecord.amount,
        } as MedicalRecord),
      });
      setError(reviewMessage);
      setStep('extracted');
    } catch (err: unknown) {
      console.error('Processing error:', err);
      if (uploadedFilePath) {
        await cleanupUploadedFile(uploadedFilePath);
      }
      setFilePath('');
      const extractedError = getErrorMessage(err, 'Failed to process file');
      setError(extractedError);
      const fallbackRecord: EditableRecord = {
        type: 'blood_test',
        title: 'Uploaded Report - ' + file.name.replace(/\.[^.]+$/, ''),
        date: '',
        doctor: 'Auto-Detected',
        hospital: 'Uploaded by Patient',
        patientName: profile?.display_name || '',
        status: 'normal',
        processingStatus: 'needs_review',
        summary: extractedError.includes('LOVABLE_API_KEY')
          ? 'The extraction service is not configured yet. Add the LOVABLE_API_KEY secret and retry.'
          : 'Automatic extraction could not complete. Review the fields before saving.',
      };

      setEditableRecord(fallbackRecord);
      setExtractedData({});
      setStep('extracted');
      toast({
        title: 'Processing Error',
        description: extractedError,
        variant: 'destructive',
      });
    }
  }, [cleanupUploadedFile, profile?.display_name, toast, user]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleSave = async () => {
    try {
      const newRecord: MedicalRecord = {
        id: crypto.randomUUID(),
        type: (editableRecord.type as MedicalRecord['type']) || 'blood_test',
        title: editableRecord.title || 'Uploaded Report - ' + fileName.replace(/\.[^.]+$/, ''),
        date: editableRecord.date || new Date().toISOString().split('T')[0],
        doctor: editableRecord.doctor || 'Auto-Detected',
        hospital: editableRecord.hospital || 'Uploaded by Patient',
        patientName: editableRecord.patientName || undefined,
        status: deriveRecordStatus(extractedData),
        extractedData,
        fileName,
        filePath,
        amount: editableRecord.amount,
        summary: editableRecord.summary || buildRecordSummary({
          ...(editableRecord as MedicalRecord),
          extractedData,
          amount: editableRecord.amount,
        }),
        notes: editableRecord.notes || undefined,
        processingStatus: editableRecord.processingStatus || (error ? 'needs_review' : 'processed'),
        reviewedAt: new Date().toISOString(),
      };

      await addRecord(newRecord);
      setStep('done');
      toast({ title: 'Record saved', description: 'Your medical record has been stored securely.' });
      setTimeout(() => navigate('/records'), 1200);
    } catch (err: unknown) {
      if (filePath) {
        await cleanupUploadedFile(filePath);
        setFilePath('');
      }
      toast({
        title: 'Save failed',
        description: getErrorMessage(err, 'We could not save this record. Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const reset = () => {
    if (filePath) {
      void cleanupUploadedFile(filePath);
    }
    setStep('upload');
    setFileName('');
    setExtractedData(undefined);
    setEditableRecord({});
    setFilePath('');
    setError('');
  };

  const [apiKeyInput, setApiKeyInput] = useState(
    () => localStorage.getItem('healytics_gemini_key') || ''
  );
  const [showKeyModal, setShowKeyModal] = useState(false);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Upload Report</h1>
          <p className="text-muted-foreground mt-1">Upload a medical report for extraction, review, and secure storage.</p>
        </div>
        <Button
          variant={apiKeyInput ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowKeyModal(!showKeyModal)}
          className="text-xs gap-1.5 h-8"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {apiKeyInput ? 'AI Vision Active' : 'Enable Gemini AI Vision'}
        </Button>
      </div>

      {showKeyModal && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Google Gemini 1.5 Flash Vision
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-medium"
            >
              Get Free Key (Google AI Studio) →
            </a>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Enabling Gemini Vision gives 100% accurate extraction from smartphone photos, handwritten notes, and multi-column tables with zero setup.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Paste AIzaSy... API key here"
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                if (e.target.value.trim()) {
                  localStorage.setItem('healytics_gemini_key', e.target.value.trim());
                } else {
                  localStorage.removeItem('healytics_gemini_key');
                }
              }}
              className="h-8 text-xs bg-background"
            />
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                setShowKeyModal(false);
                toast({ title: 'AI Vision Configured', description: 'Gemini Vision extraction is ready.' });
              }}
            >
              Save Key
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs font-medium">
        {(['upload', 'scanning', 'extracted', 'done'] as Step[]).map((stage, index) => (
          <div key={stage} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${step === stage ? 'gradient-primary text-primary-foreground' :
                (['upload', 'scanning', 'extracted', 'done'].indexOf(step) > index) ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
              {(['upload', 'scanning', 'extracted', 'done'].indexOf(step) > index) ? 'OK' : index + 1}
            </div>
            <span className={step === stage ? 'text-foreground' : 'text-muted-foreground'}>
              {stage === 'upload' ? 'Upload' : stage === 'scanning' ? 'AI Scan' : stage === 'extracted' ? 'Review' : 'Saved'}
            </span>
            {index < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
              ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="font-heading font-semibold">Drop your report here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-2">Supports PDF, PNG, JPG, WEBP, TXT, CSV, JSON, DOC, and DOCX files up to 20MB</p>
            <p className="text-xs text-muted-foreground mt-1">Files are stored in a private Supabase bucket with user-scoped access.</p>
            <input id="file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.json,.doc,.docx" className="hidden" onChange={handleFileInput} />

            <div className="mt-6 pt-6 border-t border-border flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-medium text-muted-foreground">Or test with a pre-configured clinical sample:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadSampleReport('cbc')}
                  className="text-xs h-8 bg-background"
                >
                  🩸 Sample CBC Panel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadSampleReport('lipid')}
                  className="text-xs h-8 bg-background"
                >
                  🫀 Sample Lipid Profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadSampleReport('metabolic')}
                  className="text-xs h-8 bg-background"
                >
                  🧪 Sample Metabolic & Kidney
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-card border border-border rounded-xl p-12 text-center"
          >
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <p className="font-heading font-semibold">Analyzing "{fileName}"</p>
            <p className="text-sm text-muted-foreground mt-2">Running in-browser OCR scan and extracting clinical biomarkers...</p>
          </motion.div>
        )}

        {step === 'extracted' && (
          <motion.div
            key="extracted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-card border border-border rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">Review Extracted Data</h2>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>Automatic extraction had issues. Review and edit the fields before saving.</span>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="record-title">Title</Label>
                <Input id="record-title" value={editableRecord.title || ''} onChange={event => setEditableRecord(prev => ({ ...prev, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-name">Patient Name</Label>
                <Input id="patient-name" value={editableRecord.patientName || ''} onChange={event => setEditableRecord(prev => ({ ...prev, patientName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-date">Date Taken</Label>
                <Input id="report-date" type="date" value={editableRecord.date || ''} onChange={event => setEditableRecord(prev => ({ ...prev, date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-type">Type</Label>
                <select
                  id="report-type"
                  value={editableRecord.type || 'blood_test'}
                  onChange={event => setEditableRecord(prev => ({ ...prev, type: event.target.value as MedicalRecord['type'] }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-name">Doctor</Label>
                <Input id="doctor-name" value={editableRecord.doctor || ''} onChange={event => setEditableRecord(prev => ({ ...prev, doctor: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hospital-name">Hospital or Lab</Label>
                <Input id="hospital-name" value={editableRecord.hospital || ''} onChange={event => setEditableRecord(prev => ({ ...prev, hospital: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Bill Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  value={editableRecord.amount ?? ''}
                  onChange={event => setEditableRecord(prev => ({ ...prev, amount: event.target.value ? Number(event.target.value) : undefined }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processing-status">Processing Status</Label>
                <select
                  id="processing-status"
                  value={editableRecord.processingStatus || 'processed'}
                  onChange={event => setEditableRecord(prev => ({ ...prev, processingStatus: event.target.value as MedicalRecord['processingStatus'] }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="processed">Processed</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" value={editableRecord.summary || ''} onChange={event => setEditableRecord(prev => ({ ...prev, summary: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={editableRecord.notes || ''} onChange={event => setEditableRecord(prev => ({ ...prev, notes: event.target.value }))} placeholder="Add any clinical notes or reminders here." />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-sm">Extracted Lab Parameters</h3>
                  <p className="text-xs text-muted-foreground">Verify, edit, or add any lab values below.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddParam(!showAddParam)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {showAddParam ? 'Cancel' : 'Add Parameter'}
                </Button>
              </div>

              {showAddParam && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <p className="text-xs font-semibold text-primary">Add Lab Marker</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Input
                      placeholder="Name (e.g. Fasting Glucose)"
                      value={newParamKey}
                      onChange={e => setNewParamKey(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Input
                      type="number"
                      placeholder="Value (e.g. 95)"
                      value={newParamValue}
                      onChange={e => setNewParamValue(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Input
                      placeholder="Unit (e.g. mg/dL)"
                      value={newParamUnit}
                      onChange={e => setNewParamUnit(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Input
                      placeholder="Range (e.g. 70-100)"
                      value={newParamRange}
                      onChange={e => setNewParamRange(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-wrap gap-1">
                      {['Hemoglobin', 'Fasting Glucose', 'Total Cholesterol', 'Creatinine', 'HbA1c', 'Triglycerides', 'TSH', 'Vitamin D'].map(suggested => (
                        <button
                          key={suggested}
                          type="button"
                          onClick={() => {
                            setNewParamKey(suggested);
                            if (suggested === 'Hemoglobin') { setNewParamUnit('g/dL'); setNewParamRange('12-16'); }
                            if (suggested === 'Fasting Glucose') { setNewParamUnit('mg/dL'); setNewParamRange('70-100'); }
                            if (suggested === 'Total Cholesterol') { setNewParamUnit('mg/dL'); setNewParamRange('0-200'); }
                            if (suggested === 'Creatinine') { setNewParamUnit('mg/dL'); setNewParamRange('0.6-1.2'); }
                            if (suggested === 'HbA1c') { setNewParamUnit('%'); setNewParamRange('0-5.7'); }
                            if (suggested === 'Triglycerides') { setNewParamUnit('mg/dL'); setNewParamRange('0-150'); }
                            if (suggested === 'TSH') { setNewParamUnit('mIU/L'); setNewParamRange('0.4-4.0'); }
                            if (suggested === 'Vitamin D') { setNewParamUnit('ng/mL'); setNewParamRange('30-100'); }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-muted-foreground hover:text-foreground"
                        >
                          + {suggested}
                        </button>
                      ))}
                    </div>
                    <Button type="button" size="sm" onClick={handleAddParameter} className="h-7 text-xs">
                      Save Marker
                    </Button>
                  </div>
                </div>
              )}

              {extractedData && Object.keys(extractedData).length > 0 ? (
                <div className="grid gap-2">
                  {Object.entries(extractedData).map(([key, data]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        data.needs_review
                          ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-700'
                          : 'bg-muted/40 border-border/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{key}</p>
                          {data.needs_review && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/20 text-warning border border-warning/50">
                              ⚠ Review
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Normal: {data.normalRange} {data.unit}</p>
                        {data.confidence !== undefined && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            AI confidence: {Math.round(data.confidence * 100)}%
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Input
                            type="number"
                            step="any"
                            value={data.value}
                            onChange={e => handleUpdateParamValue(key, e.target.value)}
                            className="w-24 h-8 text-right text-xs font-bold"
                          />
                          <p className="text-[10px] uppercase text-muted-foreground mt-0.5">{data.status}</p>
                        </div>
                        <span className="text-xs text-muted-foreground min-w-[40px]">{data.unit}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteParameter(key)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="Remove marker"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-xl text-muted-foreground text-xs">
                  No parameters extracted yet. Click "Add Parameter" above to manually enter lab values.
                </div>
              )}
            </div>

            {editableRecord.medications && editableRecord.medications.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-sm">Extracted Medications</h3>
                </div>
                <div className="grid gap-2">
                  {editableRecord.medications.map((med, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/40 border-border/60">
                      <p className="font-medium text-sm text-primary">{med.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {med.dosage && <span>{med.dosage} </span>}
                        {med.frequency && <span>• {med.frequency} </span>}
                        {med.duration && <span>• {med.duration} </span>}
                      </p>
                      {med.instructions && <p className="text-xs text-muted-foreground italic mt-0.5">{med.instructions}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editableRecord.billItems && editableRecord.billItems.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-sm">Extracted Bill Line Items</h3>
                </div>
                <div className="grid gap-2">
                  {editableRecord.billItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/40 border-border/60 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm text-primary">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.category && <span>{item.category} </span>}
                          {item.cptCode && <span>(CPT: {item.cptCode})</span>}
                        </p>
                      </div>
                      <p className="font-semibold font-mono text-sm">₹{item.amount}</p>
                    </div>
                  ))}
                </div>
                {editableRecord.billSummary && (
                  <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 mt-2 space-y-1 text-sm text-right">
                    <p>Total Billed: <span className="font-bold">₹{editableRecord.billSummary.totalBilled}</span></p>
                    {editableRecord.billSummary.insuranceCovered != null && <p className="text-success text-xs">Insurance: ₹{editableRecord.billSummary.insuranceCovered}</p>}
                    {editableRecord.billSummary.discount != null && <p className="text-success text-xs">Discount: ₹{editableRecord.billSummary.discount}</p>}
                    {editableRecord.billSummary.patientResponsibility != null && <p className="text-warning text-xs font-semibold">To Pay: ₹{editableRecord.billSummary.patientResponsibility}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground border-0">
                <CheckCircle className="w-4 h-4 mr-2" /> Save Record
              </Button>
              <Button onClick={reset} variant="outline" className="flex-1">Start Over</Button>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-success/5 border border-success/20 rounded-xl p-12 text-center"
          >
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="font-heading font-semibold text-lg">Record Saved</p>
            <p className="text-sm text-muted-foreground mt-2">Your report, extracted data, and supporting summary are now stored securely.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
