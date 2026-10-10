import type { MedicalRecord } from './mockData';

export type ExtractedMetric = NonNullable<MedicalRecord['extractedData']>[string];

export interface MetricValidationIssue {
  metric: string;
  severity: 'warning' | 'critical';
  message: string;
}

interface MetricRule {
  aliases: string[];
  plausibleMin: number;
  plausibleMax: number;
  criticalLow?: number;
  criticalHigh?: number;
  preferredUnit: string;
  unitConversions?: Record<string, (value: number) => number>;
}

const metricRules: Record<string, MetricRule> = {
  Hemoglobin: {
    aliases: ['hemoglobin', 'hb', 'hgb', 'haemoglobin'],
    plausibleMin: 2,
    plausibleMax: 25,
    criticalLow: 7,
    criticalHigh: 20,
    preferredUnit: 'g/dL',
  },
  'Fasting Glucose': {
    aliases: ['fasting glucose', 'glucose', 'blood glucose', 'sugar', 'fasting blood sugar'],
    plausibleMin: 20,
    plausibleMax: 700,
    criticalLow: 50,
    criticalHigh: 300,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'mmol/l': (value) => value * 18.0182,
      mmol: (value) => value * 18.0182,
    },
  },
  'Total Cholesterol': {
    aliases: ['total cholesterol', 'cholesterol'],
    plausibleMin: 50,
    plausibleMax: 600,
    criticalHigh: 300,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'mmol/l': (value) => value * 38.67,
      mmol: (value) => value * 38.67,
    },
  },
  'LDL Cholesterol': {
    aliases: ['ldl cholesterol', 'ldl'],
    plausibleMin: 10,
    plausibleMax: 400,
    criticalHigh: 190,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'mmol/l': (value) => value * 38.67,
      mmol: (value) => value * 38.67,
    },
  },
  'HDL Cholesterol': {
    aliases: ['hdl cholesterol', 'hdl'],
    plausibleMin: 5,
    plausibleMax: 150,
    criticalLow: 25,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'mmol/l': (value) => value * 38.67,
      mmol: (value) => value * 38.67,
    },
  },
  Triglycerides: {
    aliases: ['triglycerides', 'triglyceride'],
    plausibleMin: 20,
    plausibleMax: 1500,
    criticalHigh: 500,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'mmol/l': (value) => value * 88.57,
      mmol: (value) => value * 88.57,
    },
  },
  Creatinine: {
    aliases: ['creatinine'],
    plausibleMin: 0.1,
    plausibleMax: 20,
    criticalHigh: 5,
    preferredUnit: 'mg/dL',
    unitConversions: {
      'umol/l': (value) => value / 88.4,
      'µmol/l': (value) => value / 88.4,
      umol: (value) => value / 88.4,
    },
  },
  HbA1c: {
    aliases: ['hba1c', 'hb a1c', 'a1c'],
    plausibleMin: 3,
    plausibleMax: 18,
    criticalHigh: 10,
    preferredUnit: '%',
  },
  WBC: {
    aliases: ['total w.b.c', 'total wbc', 'w.b.c', 'wbc', 'white blood cells', 'total leukocyte count'],
    plausibleMin: 0.5,
    plausibleMax: 150000,
    preferredUnit: 'cells/cumm',
  },
  Platelets: {
    aliases: ['platelet count', 'total platelet count', 'platelets'],
    plausibleMin: 0.1,
    plausibleMax: 2000,
    preferredUnit: 'Lakhs/cumm',
  },
  RBC: {
    aliases: ['total r.b.c', 'total rbc', 'r.b.c', 'rbc', 'red blood cells'],
    plausibleMin: 1,
    plausibleMax: 9,
    criticalLow: 2.5,
    criticalHigh: 7,
    preferredUnit: 'mill/cumm',
  },
  Neutrophils: {
    aliases: ['neutrophils', 'neutrophil'],
    plausibleMin: 0,
    plausibleMax: 100,
    preferredUnit: '%',
  },
  Lymphocytes: {
    aliases: ['lymphocytes', 'lymphocyte'],
    plausibleMin: 0,
    plausibleMax: 100,
    preferredUnit: '%',
  },
  Eosinophils: {
    aliases: ['eosinophils', 'eosinophil'],
    plausibleMin: 0,
    plausibleMax: 100,
    preferredUnit: '%',
  },
  Monocytes: {
    aliases: ['monocytes', 'monocyte'],
    plausibleMin: 0,
    plausibleMax: 100,
    preferredUnit: '%',
  },
  Basophils: {
    aliases: ['basophils', 'basophil'],
    plausibleMin: 0,
    plausibleMax: 100,
    preferredUnit: '%',
  },
  PCV: {
    aliases: ['p.c.v', 'p.cv', 'pcv', 'packed cell volume', 'hematocrit'],
    plausibleMin: 10,
    plausibleMax: 75,
    preferredUnit: '%',
  },
  MCV: {
    aliases: ['m.c.v', 'm.cv', 'mcv'],
    plausibleMin: 40,
    plausibleMax: 140,
    preferredUnit: 'fl',
  },
  MCH: {
    aliases: ['m.c.h', 'm.ch', 'mch'],
    plausibleMin: 10,
    plausibleMax: 50,
    preferredUnit: 'pg',
  },
  MCHC: {
    aliases: ['m.c.h.c', 'm.ch.c', 'mchc'],
    plausibleMin: 20,
    plausibleMax: 50,
    preferredUnit: '%',
  },
  Urea: {
    aliases: ['urea', 'blood urea', 'bun', 'blood urea nitrogen'],
    plausibleMin: 2,
    plausibleMax: 250,
    criticalHigh: 100,
    preferredUnit: 'mg/dL',
  },
  Bilirubin: {
    aliases: ['bilirubin', 'total bilirubin', 'serum bilirubin'],
    plausibleMin: 0,
    plausibleMax: 40,
    criticalHigh: 10,
    preferredUnit: 'mg/dL',
  },
  TSH: {
    aliases: ['tsh', 'thyroid stimulating hormone'],
    plausibleMin: 0,
    plausibleMax: 100,
    criticalHigh: 20,
    preferredUnit: 'mIU/L',
  },
  'Vitamin D': {
    aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy vitamin d'],
    plausibleMin: 0,
    plausibleMax: 200,
    criticalLow: 10,
    preferredUnit: 'ng/mL',
  },
};

export function getKnownMetricNames() {
  return Object.keys(metricRules);
}

export function getMetricAliases(metricName: string) {
  return metricRules[metricName]?.aliases ?? [];
}

export function canonicalMetricName(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return Object.entries(metricRules).find(([name, rule]) => (
    name.toLowerCase() === normalized || rule.aliases.some((alias) => alias === normalized)
  ))?.[0];
}

function parseRange(normalRange: string): { min: number; max: number } | null {
  if (!normalRange || normalRange === 'N/A') return null;

  // Standard: "12-16" or "12.5 - 16.0"
  const rangeMatch = normalRange.match(/(-?[\d.]+)\s*[-–]\s*(-?[\d.]+)/);
  if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };

  // Greater than: ">4000" or ">= 4000"
  const gtMatch = normalRange.match(/>=?\s*([\d.]+)/);
  if (gtMatch) return { min: Number(gtMatch[1]), max: 999999999 };

  // Less than: "<0.5" or "<= 0.5"
  const ltMatch = normalRange.match(/<=?\s*([\d.]+)/);
  if (ltMatch) return { min: -999999999, max: Number(ltMatch[1]) };

  return null;
}

function statusFromRange(value: number, normalRange: string): ExtractedMetric['status'] {
  const range = parseRange(normalRange);
  if (!range) return 'normal';
  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'normal';
}

function normalizeUnit(value: string) {
  return value.trim().replace(/μ/g, 'µ').toLowerCase();
}

export function normalizeExtractedData(extractedData?: MedicalRecord['extractedData']) {
  const normalized: NonNullable<MedicalRecord['extractedData']> = {};
  const issues: MetricValidationIssue[] = [];

  for (const [rawName, metric] of Object.entries(extractedData ?? {})) {
    const canonical = canonicalMetricName(rawName) ?? rawName;
    const rule = metricRules[canonical];
    let value = Number(metric.value);
    let unit = metric.unit;

    if (!Number.isFinite(value)) {
      issues.push({
        metric: canonical,
        severity: 'critical',
        message: `${canonical} has a non-numeric value and was not included.`,
      });
      continue;
    }

    const converter = rule?.unitConversions?.[normalizeUnit(unit)];
    if (converter) {
      value = Number(converter(value).toFixed(2));
      unit = rule.preferredUnit;
    }

    const normalRange = metric.normalRange || 'N/A';
    const derivedStatus = statusFromRange(value, normalRange);

    // Carry through AI-generated confidence and needs_review flags
    let needsReviewFlag = metric.needs_review;
    const confidence    = metric.confidence;

    if (rule && (value < rule.plausibleMin || value > rule.plausibleMax)) {
      issues.push({
        metric: canonical,
        severity: 'critical',
        message: `${canonical} value ${value} ${unit} is outside plausible human limits.`,
      });
      // Force needs_review for physiologically impossible values
      needsReviewFlag = true;
    } else if (
      rule &&
      ((rule.criticalLow != null && value < rule.criticalLow) || (rule.criticalHigh != null && value > rule.criticalHigh))
    ) {
      issues.push({
        metric: canonical,
        severity: 'critical',
        message: `${canonical} value ${value} ${unit} crosses a critical threshold.`,
      });
    } else if (metric.status !== derivedStatus) {
      issues.push({
        metric: canonical,
        severity: 'warning',
        message: `${canonical} status recalculated from ${metric.status} to ${derivedStatus}.`,
      });
    }

    const nextMetric: ExtractedMetric = {
      value,
      unit,
      normalRange,
      status:      derivedStatus,
      confidence,                                        // ← PRESERVED
      needs_review: needsReviewFlag || undefined,        // ← PRESERVED + physiological flag
    };

    normalized[canonical] = nextMetric;
  }

  return { extractedData: normalized, issues };
}


export function hasCriticalValidationIssue(issues: MetricValidationIssue[]) {
  return issues.some((issue) => issue.severity === 'critical');
}
