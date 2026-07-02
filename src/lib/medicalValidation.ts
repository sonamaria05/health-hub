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
    aliases: ['hemoglobin', 'hb'],
    plausibleMin: 2,
    plausibleMax: 25,
    criticalLow: 7,
    criticalHigh: 20,
    preferredUnit: 'g/dL',
  },
  'Fasting Glucose': {
    aliases: ['fasting glucose', 'glucose', 'blood glucose', 'sugar'],
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
    aliases: ['wbc', 'white blood cells', 'white blood cell count'],
    plausibleMin: 0.5,
    plausibleMax: 100,
    criticalLow: 2,
    criticalHigh: 30,
    preferredUnit: '10^3/uL',
  },
  Platelets: {
    aliases: ['platelets', 'platelet count'],
    plausibleMin: 5,
    plausibleMax: 1500,
    criticalLow: 50,
    criticalHigh: 1000,
    preferredUnit: '10^3/uL',
  },
  RBC: {
    aliases: ['rbc', 'red blood cells', 'red blood cell count'],
    plausibleMin: 1,
    plausibleMax: 9,
    criticalLow: 2.5,
    criticalHigh: 7,
    preferredUnit: '10^6/uL',
  },
  Urea: {
    aliases: ['urea', 'blood urea'],
    plausibleMin: 2,
    plausibleMax: 250,
    criticalHigh: 100,
    preferredUnit: 'mg/dL',
  },
  Bilirubin: {
    aliases: ['bilirubin', 'total bilirubin'],
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

function parseRange(normalRange: string) {
  const match = normalRange.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
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
    const nextMetric: ExtractedMetric = {
      value,
      unit,
      normalRange,
      status: statusFromRange(value, normalRange),
    };

    if (rule && (value < rule.plausibleMin || value > rule.plausibleMax)) {
      issues.push({
        metric: canonical,
        severity: 'critical',
        message: `${canonical} value ${value} ${unit} is outside plausible human limits and should be manually reviewed.`,
      });
    } else if (
      rule &&
      ((rule.criticalLow != null && value < rule.criticalLow) || (rule.criticalHigh != null && value > rule.criticalHigh))
    ) {
      issues.push({
        metric: canonical,
        severity: 'critical',
        message: `${canonical} value ${value} ${unit} crosses a critical review threshold.`,
      });
    } else if (metric.status !== nextMetric.status) {
      issues.push({
        metric: canonical,
        severity: 'warning',
        message: `${canonical} status was recalculated from ${metric.status} to ${nextMetric.status}.`,
      });
    }

    normalized[canonical] = nextMetric;
  }

  return { extractedData: normalized, issues };
}

export function hasCriticalValidationIssue(issues: MetricValidationIssue[]) {
  return issues.some((issue) => issue.severity === 'critical');
}
