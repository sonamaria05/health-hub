import { MedicalRecord, PredictionResult } from './mockData';

export interface MetricDefinition {
  key: string;
  label: string;
  color: string;
  normalMin: number;
  normalMax: number;
}

export const baseMetrics: MetricDefinition[] = [
  { key: 'hemoglobin', label: 'Hemoglobin (g/dL)', color: '#0d9488', normalMin: 12, normalMax: 16 },
  { key: 'glucose', label: 'Fasting Glucose (mg/dL)', color: '#3b82f6', normalMin: 70, normalMax: 100 },
  { key: 'cholesterol', label: 'Total Cholesterol (mg/dL)', color: '#f59e0b', normalMin: 0, normalMax: 200 },
  { key: 'creatinine', label: 'Creatinine (mg/dL)', color: '#8b5cf6', normalMin: 0.6, normalMax: 1.2 },
  { key: 'hba1c', label: 'HbA1c (%)', color: '#ef4444', normalMin: 0, normalMax: 5.7 },
  { key: 'ldl', label: 'LDL Cholesterol (mg/dL)', color: '#f97316', normalMin: 0, normalMax: 100 },
  { key: 'triglycerides', label: 'Triglycerides (mg/dL)', color: '#14b8a6', normalMin: 0, normalMax: 150 },
];

const keyMapping: Record<string, string> = {
  Hemoglobin: 'hemoglobin',
  'Fasting Glucose': 'glucose',
  Glucose: 'glucose',
  'Total Cholesterol': 'cholesterol',
  Cholesterol: 'cholesterol',
  Creatinine: 'creatinine',
  HbA1c: 'hba1c',
  'LDL Cholesterol': 'ldl',
  Triglycerides: 'triglycerides',
};

function getLatestRecordWithExtractedData(records: MedicalRecord[]) {
  return [...records]
    .filter(record => record.extractedData && Object.keys(record.extractedData).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

export function buildChartData(records: MedicalRecord[]) {
  return records
    .filter(record => record.extractedData && record.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(record => {
      const point: Record<string, string | number> = {
        date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };

      for (const [key, value] of Object.entries(record.extractedData ?? {})) {
        const mappedKey = keyMapping[key];
        if (mappedKey) {
          point[mappedKey] = value.value;
        }
      }

      return point;
    })
    .filter(point => Object.keys(point).length > 1);
}

export function collectLatestParameters(records: MedicalRecord[]) {
  const latestByParameter: NonNullable<MedicalRecord['extractedData']> = {};
  const sortedRecords = [...records]
    .filter(record => record.extractedData && Object.keys(record.extractedData).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const record of sortedRecords) {
    for (const [key, value] of Object.entries(record.extractedData ?? {})) {
      if (!latestByParameter[key]) {
        latestByParameter[key] = value;
      }
    }
  }

  return latestByParameter;
}

export function generateHealthInsights(records: MedicalRecord[]): PredictionResult[] {
  const result: PredictionResult[] = [];

  const latest = getLatestRecordWithExtractedData(records);

  if (!latest || !latest.extractedData) return result;

  const allParams = latest.extractedData;

  const hb = allParams.Hemoglobin;
  if (hb) {
    const risk = hb.value < 11 ? 'high' : hb.value < 12 ? 'moderate' : 'low';
    result.push({
      condition: 'Anemia Risk',
      risk,
      probability: hb.value < 11 ? 78 : hb.value < 12 ? 55 : 15,
      factors: [
        `Hemoglobin: ${hb.value} ${hb.unit} (normal: ${hb.normalRange})`,
        hb.status !== 'normal' ? 'Below normal range detected' : 'Within normal range',
      ],
      recommendation: risk === 'low'
        ? 'Continue healthy diet and regular monitoring.'
        : 'Consider an iron-rich diet and follow-up CBC in 4 weeks.',
    });
  }

  const chol = allParams['Total Cholesterol'] || allParams.Cholesterol;
  const ldl = allParams['LDL Cholesterol'];
  const trig = allParams.Triglycerides;
  if (chol || ldl || trig) {
    const factors: string[] = [];
    let riskScore = 0;

    if (chol && chol.value > 200) {
      factors.push(`Total Cholesterol: ${chol.value} ${chol.unit}`);
      riskScore += 20;
    }
    if (ldl && ldl.value > 100) {
      factors.push(`LDL: ${ldl.value} ${ldl.unit}`);
      riskScore += 25;
    }
    if (trig && trig.value > 150) {
      factors.push(`Triglycerides: ${trig.value} ${trig.unit}`);
      riskScore += 15;
    }
    if (factors.length === 0) {
      factors.push('Lipid values are within normal range');
    }

    result.push({
      condition: 'Cardiovascular Risk',
      risk: riskScore > 50 ? 'high' : riskScore > 30 ? 'moderate' : 'low',
      probability: Math.min(riskScore + 10, 90),
      factors,
      recommendation: riskScore > 30
        ? 'Lifestyle changes are recommended. Consider exercise and nutrition follow-up.'
        : 'Continue current lifestyle habits and routine monitoring.',
    });
  }

  const glucose = allParams['Fasting Glucose'] || allParams.Glucose;
  const hba1c = allParams.HbA1c;
  if (glucose || hba1c) {
    const factors: string[] = [];
    let riskScore = 0;

    if (glucose) {
      factors.push(`Fasting Glucose: ${glucose.value} ${glucose.unit}`);
      if (glucose.value > 100) riskScore += 30;
    }
    if (hba1c) {
      factors.push(`HbA1c: ${hba1c.value}%`);
      if (hba1c.value > 5.7) riskScore += 35;
    }

    result.push({
      condition: 'Diabetes Risk',
      risk: riskScore > 50 ? 'high' : riskScore > 30 ? 'moderate' : 'low',
      probability: Math.min(riskScore + 8, 90),
      factors,
      recommendation: riskScore > 30
        ? 'Follow up with your clinician for glucose management guidance.'
        : 'Continue healthy diet habits and annual glucose screening.',
    });
  }

  const creatinine = allParams.Creatinine;
  if (creatinine) {
    const risk = creatinine.value > 1.4 ? 'high' : creatinine.value > 1.2 ? 'moderate' : 'low';
    result.push({
      condition: 'Kidney Function',
      risk,
      probability: creatinine.value > 1.4 ? 65 : creatinine.value > 1.2 ? 35 : 12,
      factors: [`Creatinine: ${creatinine.value} ${creatinine.unit} (normal: ${creatinine.normalRange})`],
      recommendation: risk === 'low'
        ? 'No immediate concern. Continue routine monitoring.'
        : 'Discuss kidney function results with your clinician.',
    });
  }

  return result;
}
