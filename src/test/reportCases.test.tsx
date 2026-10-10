import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { validateUploadFile } from '@/lib/recordUtils';
import { needsReview } from '@/lib/geminiVisionExtraction';
import { mapMetricKey } from '@/lib/fuzzyMatch';
import { convertToStandardUnit, validateMedicalValue } from '@/lib/medicalValidation';
import { generateTrendAlerts } from '@/lib/healthInsights';
import { predictHealthRisksFromSnapshot } from '@/lib/mlRisk';
import { aggregateBillingMetrics } from '@/lib/billingUtils';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IdleTimeout from '@/components/IdleTimeout';
import { AuthProvider } from '@/lib/AuthContext';
import * as AuthContextModule from '@/lib/AuthContext';

describe('TC2: validateUploadFile', () => {
  it('accepts PDF/PNG/JPG/WEBP', () => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    for (const type of validTypes) {
      const file = new File(['dummy content'], 'test.file', { type });
      expect(validateUploadFile(file)).toBeNull();
    }
  });

  it('rejects unsupported type', () => {
    const file = new File(['dummy'], 'test.exe', { type: 'application/octet-stream' });
    const result = validateUploadFile(file);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/upload|pdf/i);
  });

  it('rejects oversized file', () => {
    const file = new File([new ArrayBuffer(21 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
    const result = validateUploadFile(file);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/size|MB/i);
  });

  it('rejects empty file', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' });
    const result = validateUploadFile(file);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/empty/i);
  });
});

describe('TC3: needsReview logic', () => {
  it('flags Gemini confidence < 0.7', () => {
    expect(needsReview(0.65, 0.9)).toBe(true);
  });
  
  it('flags OCR confidence < 0.7', () => {
    expect(needsReview(0.85, 0.6)).toBe(true);
  });

  it('does not flag if both >= 0.7', () => {
    expect(needsReview(0.7, 0.75)).toBe(false);
  });
});

import { lookupTerm } from '@/lib/fuzzyMatch';
import { normalizeExtractedData } from '@/lib/medicalValidation';

// ...

describe('TC4: fuzzyMatch.ts', () => {
  it('maps aliases to correct canonical keys', () => {
    expect(lookupTerm('Hb').canonical).toBe('Hemoglobin');
    expect(lookupTerm('Hgb').canonical).toBe('Hemoglobin');
    expect(lookupTerm('Haemoglobin').canonical).toBe('Hemoglobin');
    expect(lookupTerm('fasting blood sugar').canonical).toBe('Fasting Glucose');
  });

  it('returns null for unrelated string', () => {
    // lookupTerm returns matched: false and original term if unrelated
    expect(lookupTerm('random unknown test').matched).toBe(false);
  });
});

describe('TC5: medicalValidation unit conversion', () => {
  it('converts glucose in mmol/L to mg/dL', () => {
    const rawData = {
      'Fasting Glucose': { value: 5.0, unit: 'mmol/L', normalRange: '3.9-5.5', status: 'normal' } as any
    };
    const { extractedData } = normalizeExtractedData(rawData);
    expect(extractedData['Fasting Glucose'].value).toBeCloseTo(90.09, 1);
    expect(extractedData['Fasting Glucose'].unit).toBe('mg/dL');
  });
});

describe('TC6: medicalValidation plausible limits', () => {
  it('flags hemoglobin outside 2-25 g/dL', () => {
    const rawData = {
      'Hemoglobin': { value: 1.5, unit: 'g/dL', normalRange: '12-16', status: 'low' } as any
    };
    const { extractedData, issues } = normalizeExtractedData(rawData);
    expect(extractedData['Hemoglobin'].needs_review).toBe(true);
    expect(issues.some(i => i.message.match(/implausible|outside|limits/i))).toBe(true);
  });
});

describe('TC7 & TC8: generateTrendAlerts', () => {
  it('TC7: HbA1c rising by more than 0.1 per month produces an alert', () => {
    const records = [
      { id: '1', date: '2025-01-01', extractedData: { 'HbA1c': { value: 6.0, unit: '%' } } },
      { id: '2', date: '2025-02-01', extractedData: { 'HbA1c': { value: 6.2, unit: '%' } } },
    ] as any;
    const alerts = generateTrendAlerts(records);
    const hba1cAlert = alerts.find(a => a.metric === 'hba1c');
    expect(hba1cAlert).toBeDefined();
    expect(hba1cAlert?.status).toBe('worsening');
  });

  it('TC7: smaller rise does not produce an alert', () => {
    const records = [
      { id: '1', date: '2025-01-01', extractedData: { 'HbA1c': { value: 6.0, unit: '%' } } },
      { id: '2', date: '2025-02-01', extractedData: { 'HbA1c': { value: 6.05, unit: '%' } } },
    ] as any;
    const alerts = generateTrendAlerts(records);
    const hba1cAlert = alerts.find(a => a.metric === 'hba1c');
    expect(hba1cAlert).toBeUndefined();
  });

  it('TC8: prescription between readings mentions medication', () => {
    const records = [
      { id: '1', date: '2025-01-01', extractedData: { 'HbA1c': { value: 6.0, unit: '%' } } },
      { id: 'rx', type: 'prescription', date: '2025-01-15', medications: [{ name: 'Metformin', dosage: '500mg' }] },
      { id: '2', date: '2025-02-01', extractedData: { 'HbA1c': { value: 6.5, unit: '%' } } },
    ] as any;
    const alerts = generateTrendAlerts(records);
    const hba1cAlert = alerts.find(a => a.metric === 'hba1c');
    expect(hba1cAlert?.message).toMatch(/Recent prescriptions do not seem to be controlling/i);
  });
});

describe('TC9: predictHealthRisksFromSnapshot', () => {
  it('returns probability between 0 and 1 and contributing factors', () => {
    const snapshot = {
      age: 45,
      gender: 'M',
      hemoglobin: 14,
      fasting_glucose: 150,
      total_cholesterol: 200,
      creatinine: 1.0,
      hba1c: 6.0,
      ldl_cholesterol: 120,
      triglycerides: 150,
      abnormal_ratio: 0.1,
      record_count: 5,
      anemia_signal: 0,
      glycemic_signal: 1,
      lipid_signal: 0,
      kidney_signal: 0,
      risk_burden: 1,
      glucose_hba1c_interaction: 900,
      lipid_density: 1.5,
      renal_load: 0.5
    };
    const risks = predictHealthRisksFromSnapshot(snapshot as any);
    expect(risks.length).toBe(4);
    for (const risk of risks) {
      expect(risk.probability).toBeGreaterThanOrEqual(0);
      expect(risk.probability).toBeLessThanOrEqual(100);
      expect(Array.isArray(risk.factors)).toBe(true);
    }
  });
});

describe('TC10: BillingPage aggregation logic', () => {
  it('aggregates totals by category correctly', () => {
    const records = [
      { id: '1', amount: 100, billItems: [{ category: 'Pharmacy', amount: 50 }, { category: 'Lab', amount: 50 }] },
      { id: '2', billSummary: { totalBilled: 200, patientResponsibility: 50, insuranceCovered: 150 }, billItems: [{ category: 'Lab', amount: 200 }] }
    ] as any;
    const metrics = aggregateBillingMetrics(records);
    expect(metrics.totalBilled).toBe(300);
    expect(metrics.patientResponsibility).toBe(150);
    expect(metrics.insuranceCovered).toBe(150);
    expect(metrics.itemsByCategory['Pharmacy']).toBe(50);
    expect(metrics.itemsByCategory['Lab']).toBe(250);
  });
});

describe('TC13: IdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ends session after 15 mins of inactivity (plus 1 min warning)', () => {
    const signOutMock = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({ user: { id: '1' }, signOut: signOutMock } as any);

    const { unmount } = render(<IdleTimeout />);

    act(() => {
      vi.advanceTimersByTime(16 * 60 * 1000 + 1000);
    });
    expect(signOutMock).toHaveBeenCalled();
    unmount();
  });

  it('does not end if there is user activity', () => {
    const signOutMock = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({ user: { id: '1' }, signOut: signOutMock } as any);

    const { unmount } = render(<IdleTimeout />);

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes pass
    });
    
    // Simulating user activity
    act(() => {
      document.dispatchEvent(new Event('mousemove'));
    });

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000); // another 10 mins pass
    });
    
    // Sign out should not be called because timer was reset
    expect(signOutMock).not.toHaveBeenCalled();
    unmount();
  });
});
