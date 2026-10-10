import { MedicalRecord } from './mockData';

export function aggregateBillingMetrics(billingRecords: MedicalRecord[]) {
  let totalBilled = 0;
  let patientResponsibility = 0;
  let insuranceCovered = 0;
  const itemsByCategory: Record<string, number> = {};

  billingRecords.forEach(record => {
    if (record.billSummary) {
      totalBilled += record.billSummary.totalBilled || 0;
      patientResponsibility += record.billSummary.patientResponsibility || 0;
      insuranceCovered += record.billSummary.insuranceCovered || 0;
    } else if (record.amount) {
      totalBilled += record.amount;
      patientResponsibility += record.amount;
    }

    if (record.billItems) {
      record.billItems.forEach(item => {
        const cat = item.category || 'Other';
        itemsByCategory[cat] = (itemsByCategory[cat] || 0) + item.amount;
      });
    }
  });

  return { totalBilled, patientResponsibility, insuranceCovered, itemsByCategory };
}
