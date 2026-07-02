import { describe, expect, it } from 'vitest';
import { extractMedicalRecordFromText } from '@/lib/localMedicalExtraction';

describe('local medical extraction', () => {
  it('parses common lab values from text exports', () => {
    const result = extractMedicalRecordFromText(
      `Comprehensive Metabolic Panel
Patient Name: Sona Maria
Doctor: Dr. Priya Sharma
Hospital: Apollo Preventive Care
Report Date: 2025-03-15
Hemoglobin: 11.2 g/dL Normal 12-16
Fasting Glucose: 98 mg/dL Normal 70-100
Total Cholesterol: 235 mg/dL Normal 0-200
Triglycerides: 175 mg/dL Normal 0-150
Creatinine: 0.98 mg/dL Normal 0.6-1.2`,
      'panel.txt',
    );

    expect(result.record.type).toBe('blood_test');
    expect(result.record.patientName).toBe('Sona Maria');
    expect(result.record.extractedData?.Hemoglobin?.value).toBe(11.2);
    expect(result.record.extractedData?.['Total Cholesterol']?.status).toBe('high');
    expect(result.source).toBe('local_parser');
  });
});
