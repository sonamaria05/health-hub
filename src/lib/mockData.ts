export interface MedicalRecord {
  id: string;
  type: 'blood_test' | 'prescription' | 'imaging' | 'bill' | 'discharge_summary';
  title: string;
  date: string;
  doctor: string;
  hospital: string;
  patientName?: string;
  status: 'normal' | 'attention' | 'critical';
  extractedData?: Record<string, { value: number; unit: string; normalRange: string; status: 'normal' | 'high' | 'low' }>;
  amount?: number;
  fileName: string;
  filePath?: string;
  summary?: string;
  notes?: string;
  processingStatus?: 'pending' | 'processed' | 'needs_review' | 'failed';
  reviewedAt?: string;
}

export interface HealthMetric {
  date: string;
  hemoglobin: number;
  glucose: number;
  cholesterol: number;
  bp_systolic: number;
  bp_diastolic: number;
  creatinine: number;
}

const patientName = 'Sona Maria';
const physician = 'Dr. Priya Sharma';
const hospital = 'Apollo Preventive Care';

export const mockRecords: MedicalRecord[] = [
  {
    id: 'demo-12',
    type: 'blood_test',
    title: 'Comprehensive Follow-up Panel',
    date: '2025-03-15',
    doctor: physician,
    hospital,
    patientName,
    status: 'attention',
    fileName: 'followup_mar2025.pdf',
    processingStatus: 'processed',
    summary: 'Latest follow-up panel shows mild anemia and persistent lipid elevation, with glucose remaining near the upper-normal range.',
    extractedData: {
      Hemoglobin: { value: 11.2, unit: 'g/dL', normalRange: '12-16', status: 'low' },
      'Fasting Glucose': { value: 98, unit: 'mg/dL', normalRange: '70-100', status: 'normal' },
      'Total Cholesterol': { value: 235, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 0.98, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
      Triglycerides: { value: 175, unit: 'mg/dL', normalRange: '0-150', status: 'high' },
      'LDL Cholesterol': { value: 158, unit: 'mg/dL', normalRange: '0-100', status: 'high' },
    },
  },
  {
    id: 'demo-11',
    type: 'bill',
    title: 'Preventive Health Package Invoice',
    date: '2025-03-15',
    doctor: physician,
    hospital,
    patientName,
    status: 'normal',
    fileName: 'invoice_mar2025.pdf',
    amount: 4200,
    processingStatus: 'processed',
    summary: 'Invoice covering consultation, CBC, fasting glucose, kidney function, and lipid panel.',
  },
  {
    id: 'demo-10',
    type: 'blood_test',
    title: 'Cardio-Metabolic Monitoring Panel',
    date: '2025-02-14',
    doctor: 'Dr. Rajesh Kumar',
    hospital: 'Manipal Hospital',
    patientName,
    status: 'attention',
    fileName: 'panel_feb2025.pdf',
    processingStatus: 'processed',
    summary: 'Intermediate review shows modest improvement in glucose with cholesterol still elevated.',
    extractedData: {
      Hemoglobin: { value: 11.5, unit: 'g/dL', normalRange: '12-16', status: 'low' },
      'Fasting Glucose': { value: 101, unit: 'mg/dL', normalRange: '70-100', status: 'high' },
      'Total Cholesterol': { value: 230, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 1.0, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
      HbA1c: { value: 5.6, unit: '%', normalRange: '0-5.7', status: 'normal' },
    },
  },
  {
    id: 'demo-9',
    type: 'prescription',
    title: 'Lifestyle Counseling Follow-up',
    date: '2025-02-14',
    doctor: 'Dr. Rajesh Kumar',
    hospital: 'Manipal Hospital',
    patientName,
    status: 'normal',
    fileName: 'advice_feb2025.pdf',
    processingStatus: 'processed',
    summary: 'Lifestyle counseling focused on lipid reduction, higher dietary iron intake, and daily walking.',
  },
  {
    id: 'demo-8',
    type: 'blood_test',
    title: 'Quarterly Wellness Panel',
    date: '2025-01-18',
    doctor: physician,
    hospital,
    patientName,
    status: 'attention',
    fileName: 'wellness_jan2025.pdf',
    processingStatus: 'processed',
    summary: 'January wellness panel shows cholesterol rising and hemoglobin dipping below the desired range.',
    extractedData: {
      Hemoglobin: { value: 11.8, unit: 'g/dL', normalRange: '12-16', status: 'low' },
      'Fasting Glucose': { value: 105, unit: 'mg/dL', normalRange: '70-100', status: 'high' },
      'Total Cholesterol': { value: 225, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 1.05, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
      HbA1c: { value: 5.7, unit: '%', normalRange: '0-5.7', status: 'normal' },
    },
  },
  {
    id: 'demo-7',
    type: 'imaging',
    title: 'Chest X-Ray Screening',
    date: '2025-01-05',
    doctor: 'Dr. Anita Desai',
    hospital: 'Fortis Clinic',
    patientName,
    status: 'normal',
    fileName: 'xray_jan2025.pdf',
    processingStatus: 'processed',
    summary: 'Routine chest screening reported no acute radiological abnormality.',
  },
  {
    id: 'demo-6',
    type: 'blood_test',
    title: 'Annual Preventive Screening',
    date: '2024-12-16',
    doctor: physician,
    hospital,
    patientName,
    status: 'attention',
    fileName: 'screening_dec2024.pdf',
    processingStatus: 'processed',
    summary: 'December screening begins to show upward drift in cholesterol and fasting glucose.',
    extractedData: {
      Hemoglobin: { value: 12.2, unit: 'g/dL', normalRange: '12-16', status: 'normal' },
      'Fasting Glucose': { value: 100, unit: 'mg/dL', normalRange: '70-100', status: 'normal' },
      'Total Cholesterol': { value: 215, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 1.0, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
      'LDL Cholesterol': { value: 142, unit: 'mg/dL', normalRange: '0-100', status: 'high' },
    },
  },
  {
    id: 'demo-5',
    type: 'bill',
    title: 'Annual Screening Invoice',
    date: '2024-12-16',
    doctor: physician,
    hospital,
    patientName,
    status: 'normal',
    fileName: 'invoice_dec2024.pdf',
    amount: 3800,
    processingStatus: 'processed',
    summary: 'Invoice for annual screening package and physician review.',
  },
  {
    id: 'demo-4',
    type: 'blood_test',
    title: 'Nutrition Follow-up CBC and Glucose',
    date: '2024-11-12',
    doctor: 'Dr. Rajesh Kumar',
    hospital: 'Manipal Hospital',
    patientName,
    status: 'normal',
    fileName: 'followup_nov2024.pdf',
    processingStatus: 'processed',
    summary: 'Values remain close to reference range with early cholesterol elevation noted.',
    extractedData: {
      Hemoglobin: { value: 12.8, unit: 'g/dL', normalRange: '12-16', status: 'normal' },
      'Fasting Glucose': { value: 95, unit: 'mg/dL', normalRange: '70-100', status: 'normal' },
      'Total Cholesterol': { value: 205, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
      Creatinine: { value: 0.95, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
    },
  },
  {
    id: 'demo-3',
    type: 'prescription',
    title: 'Preventive Consultation Summary',
    date: '2024-11-12',
    doctor: 'Dr. Rajesh Kumar',
    hospital: 'Manipal Hospital',
    patientName,
    status: 'normal',
    fileName: 'consult_nov2024.pdf',
    processingStatus: 'processed',
    summary: 'Preventive consultation advised repeat testing in 8 to 12 weeks and regular exercise.',
  },
  {
    id: 'demo-2',
    type: 'blood_test',
    title: 'Baseline Wellness Blood Panel',
    date: '2024-10-10',
    doctor: physician,
    hospital,
    patientName,
    status: 'normal',
    fileName: 'baseline_oct2024.pdf',
    processingStatus: 'processed',
    summary: 'Baseline wellness blood panel with values broadly within normal limits.',
    extractedData: {
      Hemoglobin: { value: 13.1, unit: 'g/dL', normalRange: '12-16', status: 'normal' },
      'Fasting Glucose': { value: 92, unit: 'mg/dL', normalRange: '70-100', status: 'normal' },
      'Total Cholesterol': { value: 195, unit: 'mg/dL', normalRange: '0-200', status: 'normal' },
      Creatinine: { value: 0.9, unit: 'mg/dL', normalRange: '0.6-1.2', status: 'normal' },
      HbA1c: { value: 5.3, unit: '%', normalRange: '0-5.7', status: 'normal' },
    },
  },
  {
    id: 'demo-1',
    type: 'discharge_summary',
    title: 'Viral Fever Discharge Summary',
    date: '2024-09-02',
    doctor: 'Dr. Anita Desai',
    hospital: 'Fortis Clinic',
    patientName,
    status: 'normal',
    fileName: 'discharge_sep2024.pdf',
    processingStatus: 'processed',
    summary: 'Recovered from a short viral illness without complications.',
  },
];

export const healthTrends: HealthMetric[] = [
  { date: 'Oct 24', hemoglobin: 13.1, glucose: 92, cholesterol: 195, bp_systolic: 118, bp_diastolic: 78, creatinine: 0.9 },
  { date: 'Nov 24', hemoglobin: 12.8, glucose: 95, cholesterol: 205, bp_systolic: 122, bp_diastolic: 80, creatinine: 0.95 },
  { date: 'Dec 24', hemoglobin: 12.2, glucose: 100, cholesterol: 215, bp_systolic: 125, bp_diastolic: 82, creatinine: 1.0 },
  { date: 'Jan 25', hemoglobin: 11.8, glucose: 105, cholesterol: 225, bp_systolic: 128, bp_diastolic: 84, creatinine: 1.05 },
  { date: 'Feb 25', hemoglobin: 11.5, glucose: 101, cholesterol: 230, bp_systolic: 126, bp_diastolic: 82, creatinine: 1.0 },
  { date: 'Mar 25', hemoglobin: 11.2, glucose: 98, cholesterol: 235, bp_systolic: 124, bp_diastolic: 80, creatinine: 0.98 },
];

export const typeLabels: Record<string, string> = {
  blood_test: 'Blood Test',
  prescription: 'Prescription',
  imaging: 'Imaging',
  bill: 'Bill',
  discharge_summary: 'Discharge Summary',
};

export interface PredictionResult {
  condition: string;
  risk: 'low' | 'moderate' | 'high';
  probability: number;
  factors: string[];
  recommendation: string;
}

export const mockPredictions: PredictionResult[] = [
  {
    condition: 'Anemia Risk',
    risk: 'moderate',
    probability: 62,
    factors: ['Declining hemoglobin trend (13.1 -> 11.2)', 'Below normal range across recent follow-ups'],
    recommendation: 'Consider iron-rich nutrition, repeat CBC in 4 to 6 weeks, and clinical follow-up if fatigue persists.',
  },
  {
    condition: 'Cardiovascular Risk',
    risk: 'moderate',
    probability: 45,
    factors: ['Elevated LDL cholesterol (158 mg/dL)', 'Rising total cholesterol trend', 'Triglycerides above the reference range'],
    recommendation: 'Lifestyle modifications are recommended with repeat lipid testing in the next 3 months.',
  },
  {
    condition: 'Diabetes Risk',
    risk: 'low',
    probability: 18,
    factors: ['Fasting glucose is near the upper-normal range', 'HbA1c remains within the normal range'],
    recommendation: 'Continue regular exercise, maintain balanced meals, and repeat glucose screening on schedule.',
  },
  {
    condition: 'Kidney Function',
    risk: 'low',
    probability: 12,
    factors: ['Creatinine remains within range across sequential panels', 'No kidney-specific red flags in the sample data'],
    recommendation: 'No immediate concern. Continue routine monitoring during follow-up panels.',
  },
];
