import { MedicalRecord } from './mockData';

export const allowedUploadTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const maxUploadSizeBytes = 20 * 1024 * 1024;

export function validateUploadFile(file: File) {
  if (!allowedUploadTypes.includes(file.type) && !/\.(pdf|png|jpe?g|webp|txt|csv|json|doc|docx)$/i.test(file.name)) {
    return 'Upload a PDF, image, text export, CSV, JSON, DOC, or DOCX medical document.';
  }

  if (file.size === 0) {
    return 'File appears to be empty.';
  }

  if (file.size > maxUploadSizeBytes) {
    return 'File size must be 20MB or smaller.';
  }

  return null;
}

export function deriveRecordStatus(
  extractedData?: MedicalRecord['extractedData'],
): MedicalRecord['status'] {
  if (!extractedData || Object.keys(extractedData).length === 0) {
    return 'normal';
  }

  const hasSevereAbnormality = Object.values(extractedData).some(item => {
    if (item.status === 'normal') return false;
    const range = item.normalRange.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
    if (!range) return false;

    const min = Number(range[1]);
    const max = Number(range[3]);
    return item.value < min * 0.75 || item.value > max * 1.25;
  });

  if (hasSevereAbnormality) return 'critical';

  const hasAbnormality = Object.values(extractedData).some(item => item.status !== 'normal');
  return hasAbnormality ? 'attention' : 'normal';
}

export function buildRecordSummary(record: Pick<MedicalRecord, 'type' | 'doctor' | 'hospital' | 'extractedData' | 'amount'>) {
  if (record.type === 'bill' && record.amount) {
    return `Medical bill recorded for Rs. ${record.amount.toLocaleString()}.`;
  }

  const abnormal = Object.entries(record.extractedData ?? {}).filter(([, item]) => item.status !== 'normal');
  if (abnormal.length > 0) {
    const names = abnormal.slice(0, 3).map(([key]) => key).join(', ');
    return `Abnormal parameters detected: ${names}.`;
  }

  return `Report from ${record.doctor} at ${record.hospital}.`;
}
