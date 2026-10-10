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

  it('parses real multi-column CBC lab report OCR text with high precision', () => {
    const ocrText = `
Balagadi Road, Koppa~ 577126 Chikmagalur Dist
A Unit of Prashamani Hospital, RE [lB 9482166469
LABORATORY REPORT
| Ne Wis. SNEHA Te 26080221 50904
EES 3 21 Yrs Female SAMPLE COLLECTION AT : 12-08-2026 at 10:41 AM
PRESCRFTIONTYRER 17/5980 DATE OF REPORT . 12.06-2028 at 10:45 AM
REFERRED EY © Dr. UDAYASHANKAR
TEST PARAMETER RESULT NORMAL RANGE
COMPLETE BLOOD COUNT (CBC)
HAEMOGLOBIN 12.5 gm/dl 12 - 16 gm/dl
TOTAL W.B.C 10,300 cells/oumm 4000 - 11000 cellsicumm
NEUTROPHILS 71% 40-70%
EOSINOPHILS 05% 2-6%
BASOPHIL 00% 0-1%
LYMPHOCYTES 23% 20-40%
MONOCYTES 01% 1-3%
PLATELET COUNT 2.83 Lakhs/cumm 1.5- 4.5 Lakhs/cumm
R.B.C 4.49 milllcumm 3.5- 5.5 milllcumm
P.CV 35.7 % 37-54%
M.C.V 85.0 fl 80-100 fl
M.C.H 29.7 pg 27-34 pg
M.CH.C 34.9% 32-36%
`;
    const result = extractMedicalRecordFromText(ocrText, 'WhatsApp_Image_2026-08-05.jpeg');

    expect(result.source).toBe('local_parser');
    expect(result.record.patientName).toContain('SNEHA');
    expect(result.record.doctor).toContain('UDAYASHANKAR');
    expect(result.record.extractedData?.Hemoglobin?.value).toBe(12.5);
    expect(result.record.extractedData?.WBC?.value).toBe(10300);
    expect(result.record.extractedData?.Platelets?.value).toBe(2.83);
    expect(result.record.extractedData?.Neutrophils?.value).toBe(71);
    expect(result.record.extractedData?.Neutrophils?.status).toBe('high');
    expect(result.record.extractedData?.PCV?.value).toBe(35.7);
    expect(result.record.extractedData?.PCV?.status).toBe('low');
    expect(result.record.extractedData?.MCV?.value).toBe(85.0);
    expect(result.record.extractedData?.MCH?.value).toBe(29.7);
    expect(result.record.extractedData?.MCHC?.value).toBe(34.9);
  });
});
