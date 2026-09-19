import type { MedicalRecord } from './mockData';
import { buildRecordSummary, deriveRecordStatus } from './recordUtils';

type ExtractedMetric = NonNullable<MedicalRecord['extractedData']>[string];

export interface LocalExtractionResult {
  record: Partial<MedicalRecord>;
  source: 'local_parser' | 'manual_review';
}

const metricDefinitions = [
  { canonical: 'Hemoglobin', aliases: ['hemoglobin', 'hb'], unit: 'g/dL', range: '12-16' },
  { canonical: 'Fasting Glucose', aliases: ['fasting glucose', 'glucose', 'blood glucose', 'sugar'], unit: 'mg/dL', range: '70-100' },
  { canonical: 'Total Cholesterol', aliases: ['total cholesterol', 'cholesterol'], unit: 'mg/dL', range: '0-200' },
  { canonical: 'LDL Cholesterol', aliases: ['ldl cholesterol', 'ldl'], unit: 'mg/dL', range: '0-100' },
  { canonical: 'HDL Cholesterol', aliases: ['hdl cholesterol', 'hdl'], unit: 'mg/dL', range: '40-60' },
  { canonical: 'Triglycerides', aliases: ['triglycerides', 'triglyceride'], unit: 'mg/dL', range: '0-150' },
  { canonical: 'Creatinine', aliases: ['creatinine'], unit: 'mg/dL', range: '0.6-1.2' },
  { canonical: 'HbA1c', aliases: ['hba1c', 'hb a1c', 'a1c'], unit: '%', range: '0-5.7' },
  { canonical: 'WBC', aliases: ['wbc', 'white blood cells'], unit: '10^3/uL', range: '4-11' },
  { canonical: 'Platelets', aliases: ['platelets', 'platelet count'], unit: '10^3/uL', range: '150-450' },
  { canonical: 'RBC', aliases: ['rbc', 'red blood cells'], unit: '10^6/uL', range: '4.2-5.9' },
  { canonical: 'Urea', aliases: ['urea', 'blood urea'], unit: 'mg/dL', range: '10-50' },
  { canonical: 'Bilirubin', aliases: ['bilirubin', 'total bilirubin'], unit: 'mg/dL', range: '0.1-1.2' },
];

const typeDetectionRules: Array<{ type: MedicalRecord['type']; terms: string[] }> = [
  { type: 'bill', terms: ['invoice', 'bill amount', 'amount due', 'payment', 'receipt', 'total payable'] },
  { type: 'prescription', terms: ['prescription', 'rx', 'tablet', 'capsule', 'take once daily'] },
  { type: 'imaging', terms: ['x-ray', 'mri', 'ct scan', 'ultrasound', 'radiology', 'scan findings'] },
  { type: 'discharge_summary', terms: ['discharge summary', 'admission date', 'discharge date', 'hospital course'] },
  { type: 'blood_test', terms: ['hemoglobin', 'glucose', 'cholesterol', 'cbc', 'blood test', 'triglycerides'] },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateValue(value: string) {
  const cleaned = value.trim().replace(/[.,]$/, '');
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!dmy) return null;

  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function parseNormalRange(fragment: string, fallback: string) {
  const rangeMatch = fragment.match(/(?:range|normal|reference)[:\s]*([<>]?\s*\d+(?:\.\d+)?\s*-\s*[<>]?\s*\d+(?:\.\d+)?)/i);
  return rangeMatch?.[1]?.replace(/\s+/g, '') ?? fallback;
}

export function statusFromRange(value: number, normalRange: string): ExtractedMetric['status'] {
  const cleanRange = normalRange.trim();
  const lessThanMatch = cleanRange.match(/^[<≤]\s*(\d+(?:\.\d+)?)/);
  if (lessThanMatch) {
    const max = Number(lessThanMatch[1]);
    return value > max ? 'high' : 'normal';
  }
  const greaterThanMatch = cleanRange.match(/^[>≥]\s*(\d+(?:\.\d+)?)/);
  if (greaterThanMatch) {
    const min = Number(greaterThanMatch[1]);
    return value < min ? 'low' : 'normal';
  }
  const match = cleanRange.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return 'normal';
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'normal';
}

function detectType(text: string, fileName: string): MedicalRecord['type'] {
  const haystack = `${fileName}\n${text}`.toLowerCase();
  for (const rule of typeDetectionRules) {
    if (rule.terms.some((term) => haystack.includes(term))) {
      return rule.type;
    }
  }
  return 'blood_test';
}

function extractAmount(text: string) {
  const amountMatch = text.match(/(?:rs\.?|inr|usd|\$)\s*([0-9,]+(?:\.\d{1,2})?)/i)
    ?? text.match(/(?:amount|total|net amount|amount due)[:\s]+([0-9,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch?.[1]) return undefined;
  const numeric = Number(amountMatch[1].replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractMetrics(text: string): MedicalRecord['extractedData'] {
  const extractedData: NonNullable<MedicalRecord['extractedData']> = {};

  for (const metric of metricDefinitions) {
    for (const alias of metric.aliases) {
      const pattern = new RegExp(`${escapeRegex(alias)}[^\\n\\r:]*[:\\s]+(-?\\d+(?:\\.\\d+)?)\\s*([%a-zA-Z/^0-9.-]+)?([^\\n\\r]*)`, 'i');
      const match = text.match(pattern);
      if (!match) continue;

      const value = Number(match[1]);
      if (!Number.isFinite(value)) continue;

      const unit = (match[2] || metric.unit).trim();
      const trailing = match[3] || '';
      const normalRange = parseNormalRange(trailing, metric.range);
      extractedData[metric.canonical] = {
        value,
        unit,
        normalRange,
        status: statusFromRange(value, normalRange),
      };
      break;
    }
  }

  return extractedData;
}

function extractTitle(text: string, fileName: string, type: MedicalRecord['type']) {
  const firstContentLine = normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 4 && line.length < 90 && !/^(patient|name|date|doctor|hospital|lab)\b/i.test(line));

  if (firstContentLine) return firstContentLine;

  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const labels: Record<MedicalRecord['type'], string> = {
    blood_test: 'Blood Test Report',
    prescription: 'Prescription',
    imaging: 'Imaging Report',
    bill: 'Medical Bill',
    discharge_summary: 'Discharge Summary',
  };
  return baseName || labels[type];
}

export function extractMedicalRecordFromText(text: string, fileName: string): LocalExtractionResult {
  const normalizedText = normalizeWhitespace(text);
  const type = detectType(normalizedText, fileName);
  const extractedData = extractMetrics(normalizedText);
  const patientName = extractFirstMatch(normalizedText, [
    /patient name[:\s]+([^\n]+)/i,
    /name[:\s]+([^\n]+)/i,
  ]);
  const doctor = extractFirstMatch(normalizedText, [
    /doctor[:\s]+([^\n]+)/i,
    /(dr\.?\s+[a-z][^\n,]*)/i,
  ]) || 'Auto-Detected';
  const hospital = extractFirstMatch(normalizedText, [
    /hospital[:\s]+([^\n]+)/i,
    /lab(?:oratory)?[:\s]+([^\n]+)/i,
    /clinic[:\s]+([^\n]+)/i,
  ]) || 'Uploaded by Patient';
  const dateValue = extractFirstMatch(normalizedText, [
    /(?:report date|date of report|test date|date)[:\s]+([^\n]+)/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
    /([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})/,
  ]);
  const parsedDate = parseDateValue(dateValue) ?? new Date().toISOString().slice(0, 10);
  const amount = type === 'bill' ? extractAmount(normalizedText) : undefined;
  const title = extractTitle(normalizedText, fileName, type);
  const status = deriveRecordStatus(extractedData);
  const record: Partial<MedicalRecord> = {
    type,
    title,
    date: parsedDate,
    doctor,
    hospital,
    patientName: patientName || undefined,
    extractedData,
    amount,
    status,
    processingStatus: Object.keys(extractedData).length > 0 || type !== 'blood_test' ? 'processed' : 'needs_review',
  };

  record.summary = buildRecordSummary({
    type: record.type ?? 'blood_test',
    doctor: record.doctor ?? 'Auto-Detected',
    hospital: record.hospital ?? 'Uploaded by Patient',
    extractedData: record.extractedData,
    amount: record.amount,
  });

  return {
    record,
    source: Object.keys(extractedData).length > 0 || type !== 'blood_test' ? 'local_parser' : 'manual_review',
  };
}

export function buildManualReviewRecord(fileName: string, reason?: string): LocalExtractionResult {
  const record: Partial<MedicalRecord> = {
    type: 'blood_test',
    title: `Uploaded Report - ${fileName.replace(/\.[^.]+$/, '')}`,
    date: new Date().toISOString().slice(0, 10),
    doctor: 'Auto-Detected',
    hospital: 'Uploaded by Patient',
    status: 'normal',
    processingStatus: 'needs_review',
    summary: reason || 'Automatic extraction could not complete. Review the fields before saving.',
    extractedData: {},
  };

  return {
    record,
    source: 'manual_review',
  };
}
