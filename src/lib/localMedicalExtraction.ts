import type { MedicalRecord } from './mockData';
import { buildRecordSummary, deriveRecordStatus } from './recordUtils';

type ExtractedMetric = NonNullable<MedicalRecord['extractedData']>[string];

export interface LocalExtractionResult {
  record: Partial<MedicalRecord>;
  source: 'local_parser' | 'manual_review';
}

const metricDefinitions = [
  { canonical: 'Hemoglobin', aliases: ['hemoglobin', 'haemoglobin', 'hb'], unit: 'g/dL', range: '12-16' },
  { canonical: 'Fasting Glucose', aliases: ['fasting glucose', 'glucose', 'blood glucose', 'fasting blood sugar', 'fbs', 'sugar'], unit: 'mg/dL', range: '70-100' },
  { canonical: 'Total Cholesterol', aliases: ['total cholesterol', 'serum cholesterol', 'cholesterol'], unit: 'mg/dL', range: '0-200' },
  { canonical: 'LDL Cholesterol', aliases: ['ldl cholesterol', 'ldl', 'serum ldl'], unit: 'mg/dL', range: '0-100' },
  { canonical: 'HDL Cholesterol', aliases: ['hdl cholesterol', 'hdl', 'serum hdl'], unit: 'mg/dL', range: '40-60' },
  { canonical: 'Triglycerides', aliases: ['triglycerides', 'triglyceride', 'tg'], unit: 'mg/dL', range: '0-150' },
  { canonical: 'Creatinine', aliases: ['serum creatinine', 's. creatinine', 'creatinine'], unit: 'mg/dL', range: '0.6-1.2' },
  { canonical: 'HbA1c', aliases: ['hba1c', 'hb a1c', 'a1c', 'glycated hemoglobin'], unit: '%', range: '0-5.7' },
  { canonical: 'WBC', aliases: ['total w.b.c', 'total wbc', 'w.b.c', 'wbc', 'white blood cells', 'total leukocyte count'], unit: 'cells/cumm', range: '4000-11000' },
  { canonical: 'Platelets', aliases: ['platelet count', 'total platelet count', 'platelets'], unit: 'Lakhs/cumm', range: '1.5-4.5' },
  { canonical: 'RBC', aliases: ['total r.b.c', 'total rbc', 'r.b.c', 'rbc', 'red blood cells'], unit: 'mill/cumm', range: '3.5-5.5' },
  { canonical: 'Neutrophils', aliases: ['neutrophils', 'neutrophil'], unit: '%', range: '40-70' },
  { canonical: 'Lymphocytes', aliases: ['lymphocytes', 'lymphocyte'], unit: '%', range: '20-40' },
  { canonical: 'Eosinophils', aliases: ['eosinophils', 'eosinophil'], unit: '%', range: '1-6' },
  { canonical: 'Monocytes', aliases: ['monocytes', 'monocyte'], unit: '%', range: '1-3' },
  { canonical: 'Basophils', aliases: ['basophils', 'basophil'], unit: '%', range: '0-1' },
  { canonical: 'PCV', aliases: ['p.c.v', 'p.cv', 'pcv', 'packed cell volume', 'hematocrit'], unit: '%', range: '37-54' },
  { canonical: 'MCV', aliases: ['m.c.v', 'm.cv', 'mcv'], unit: 'fl', range: '80-100' },
  { canonical: 'MCH', aliases: ['m.c.h', 'm.ch', 'mch'], unit: 'pg', range: '27-34' },
  { canonical: 'MCHC', aliases: ['m.c.h.c', 'm.ch.c', 'mchc'], unit: '%', range: '32-36' },
  { canonical: 'RDW-CV', aliases: ['rdw-cv', 'rdw cv', 'rdw'], unit: '%', range: '11-16' },
  { canonical: 'RDW-SD', aliases: ['rdw-sd', 'rdw sd'], unit: 'fl', range: '35-56' },
  { canonical: 'MPV', aliases: ['mpv'], unit: 'fl', range: '6.5-12' },
  { canonical: 'PCT', aliases: ['pct'], unit: '%', range: '108-282' },
  { canonical: 'Urea', aliases: ['blood urea nitrogen', 'blood urea', 'urea', 'bun'], unit: 'mg/dL', range: '10-50' },
  { canonical: 'Bilirubin', aliases: ['total bilirubin', 'serum bilirubin', 'bilirubin'], unit: 'mg/dL', range: '0.1-1.2' },
  { canonical: 'Direct Bilirubin', aliases: ['direct bilirubin', 'conjugated bilirubin'], unit: 'mg/dL', range: '0.0-0.3' },
  { canonical: 'SGOT / AST', aliases: ['sgot / ast', 'sgot', 'ast', 'aspartate aminotransferase'], unit: 'U/L', range: '10-40' },
  { canonical: 'SGPT / ALT', aliases: ['sgpt / alt', 'sgpt', 'alt', 'alanine aminotransferase'], unit: 'U/L', range: '7-56' },
  { canonical: 'Alkaline Phosphatase', aliases: ['alkaline phosphatase', 'alp', 'alk phos'], unit: 'U/L', range: '44-147' },
  { canonical: 'Total Protein', aliases: ['total protein', 'serum protein'], unit: 'g/dL', range: '6.0-8.3' },
  { canonical: 'Albumin', aliases: ['serum albumin', 'albumin'], unit: 'g/dL', range: '3.5-5.5' },
  { canonical: 'Globulin', aliases: ['serum globulin', 'globulin'], unit: 'g/dL', range: '2.0-3.5' },
  { canonical: 'Uric Acid', aliases: ['serum uric acid', 'uric acid'], unit: 'mg/dL', range: '3.5-7.2' },
  { canonical: 'Calcium', aliases: ['serum calcium', 'calcium'], unit: 'mg/dL', range: '8.5-10.5' },
  { canonical: 'Sodium', aliases: ['serum sodium', 'sodium'], unit: 'mmol/L', range: '135-145' },
  { canonical: 'Potassium', aliases: ['serum potassium', 'potassium'], unit: 'mmol/L', range: '3.5-5.0' },
  { canonical: 'Chloride', aliases: ['serum chloride', 'chloride'], unit: 'mmol/L', range: '96-106' },
  { canonical: 'TSH', aliases: ['thyroid stimulating hormone', 'tsh'], unit: 'mIU/L', range: '0.4-4.0' },
  { canonical: 'T3', aliases: ['total t3', 'triiodothyronine', 't3'], unit: 'ng/dL', range: '80-200' },
  { canonical: 'T4', aliases: ['total t4', 'thyroxine', 't4'], unit: 'ug/dL', range: '4.5-12.0' },
  { canonical: 'Free T3', aliases: ['free t3', 'ft3'], unit: 'pg/mL', range: '2.0-4.4' },
  { canonical: 'Free T4', aliases: ['free t4', 'ft4'], unit: 'ng/dL', range: '0.8-1.8' },
  { canonical: 'Vitamin D', aliases: ['25-hydroxyvitamin d', '25 hydroxy vitamin d', '25-oh vitamin d', 'vitamin d'], unit: 'ng/mL', range: '30-100' },
  { canonical: 'Vitamin B12', aliases: ['vitamin b12', 'b12', 'cobalamin'], unit: 'pg/mL', range: '200-900' },
  { canonical: 'ESR', aliases: ['erythrocyte sedimentation rate', 'esr'], unit: 'mm/hr', range: '0-20' },
  { canonical: 'CRP', aliases: ['c-reactive protein', 'crp'], unit: 'mg/L', range: '0-5' },
];

const typeDetectionRules: Array<{ type: MedicalRecord['type']; terms: string[] }> = [
  { type: 'bill', terms: ['invoice', 'bill amount', 'amount due', 'payment', 'receipt', 'total payable'] },
  { type: 'prescription', terms: ['prescription', 'rx', 'tablet', 'capsule', 'take once daily'] },
  { type: 'imaging', terms: ['x-ray', 'mri', 'ct scan', 'ultrasound', 'radiology', 'scan findings'] },
  { type: 'discharge_summary', terms: ['discharge summary', 'admission date', 'discharge date', 'hospital course'] },
  { type: 'blood_test', terms: ['hemoglobin', 'glucose', 'cholesterol', 'cbc', 'blood test', 'triglycerides', 'tsh', 'thyroid', 'vitamin d', 'haemoglobin', 'differential count'] },
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

  const dmy = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!dmy) return null;

  let day = Number(dmy[1]);
  let month = Number(dmy[2]);
  const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);

  if (month > 12 && day <= 12) {
    [day, month] = [month, day];
  }

  if (day > 31 || month > 12 || month < 1) return null;

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
  const rangeMatch = fragment.match(/(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return rangeMatch[1].replace(/\s+/g, '');
  }
  return fallback;
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
  const lines = text.split('\n');

  for (const metric of metricDefinitions) {
    for (const alias of metric.aliases) {
      const aliasRegex = new RegExp(`(?:^|[^a-zA-Z])${escapeRegex(alias)}(?:$|[^a-zA-Z])`, 'i');

      const matchedLine = lines.find((line) => aliasRegex.test(line));
      if (!matchedLine) continue;

      const aliasPos = matchedLine.toLowerCase().indexOf(alias.toLowerCase());
      const afterAlias = matchedLine.slice(aliasPos + alias.length);

      // Non-greedy capture of the first numeric value on the line
      const numMatch = afterAlias.match(/[:\s|]+(-?\d[\d,]*(?:\.\d+)?)\s*([%a-zA-Z/^0-9.-]+)?(.*)$/);
      if (!numMatch) continue;

      const rawNum = numMatch[1].replace(/,/g, '');
      const value = Number(rawNum);
      if (!Number.isFinite(value)) continue;

      let unit = (numMatch[2] || '').trim();
      if (!unit || /^[-–]/.test(unit)) {
        unit = metric.unit;
      }

      const trailing = numMatch[3] || '';
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

  let rawPatient = extractFirstMatch(normalizedText, [
    /(?:patient name|pt\.?\s*name|name|ne)\s*[:|.]?\s*((?:mr|mrs|ms|miss|wis|master)\.?\s+[a-zA-Z\s]+)/i,
    /patient name[:\s]+([^\n]+)/i,
    /(?:^|\n)\s*name[:\s]+([^\n]+)/i,
  ]);
  if (rawPatient) {
    rawPatient = rawPatient
      .replace(/\s*(?:age|sex|reg|lab|dob|ref|dr|sample|date|prescr|te\b).*$/i, '')
      .replace(/^(?:wis\b)/i, 'Miss')
      .trim();
  }

  let doctor = extractFirstMatch(normalizedText, [
    /(?:referred\s+[a-z]+|doctor|consultant)\s*[:|©]?\s*(?:dr\.?\s+)?([a-zA-Z\s]+)/i,
    /(?:dr\.?\s+)([A-Z][a-zA-Z\s]+)/,
  ]) || 'Auto-Detected';

  if (doctor && doctor !== 'Auto-Detected') {
    doctor = doctor.replace(/\s*(?:mbbs|md|ms|d\.u\.s|d\s*ortho|date|sample|time).*$/i, '').trim();
    if (!doctor.toLowerCase().startsWith('dr.')) {
      doctor = `Dr. ${doctor}`;
    }
  }

  const hospitalLine = normalizedText.split('\n').find((line) =>
    /hospital|diagnostic|clinic|centre|center|laboratory/i.test(line) &&
    !/doctor|patient|report|sample/i.test(line)
  );

  let hospital = 'Uploaded by Patient';
  if (hospitalLine) {
    hospital = hospitalLine.replace(/^[^\w]+/, '').replace(/[^\w\s&,.-]+$/, '').trim();
  }

  const dateValue = extractFirstMatch(normalizedText, [
    /(?:date of report|report date|sample collection at|test date|date)\s*[:.]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
    /([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})/,
  ]);
  const parsedDate = parseDateValue(dateValue) || '';
  const amount = type === 'bill' ? extractAmount(normalizedText) : undefined;
  const title = extractTitle(normalizedText, fileName, type);
  const status = deriveRecordStatus(extractedData);
  const record: Partial<MedicalRecord> = {
    type,
    title,
    date: parsedDate,
    doctor,
    hospital,
    patientName: rawPatient || undefined,
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
    date: '',
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
