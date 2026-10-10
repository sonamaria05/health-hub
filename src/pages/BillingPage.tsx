import { useMemo } from 'react';
import { FileText, Calculator, DollarSign, Activity, CheckCircle, Hospital, Search, Building } from 'lucide-react';
import { useRecords } from '@/lib/RecordsContext';
import { motion } from 'framer-motion';
import { useMotionPreset } from '@/lib/motion';
import { aggregateBillingMetrics } from '@/lib/billingUtils';

export default function BillingPage() {
  const { records, loading } = useRecords();
  const { fadeInUp } = useMotionPreset();

  const billingRecords = useMemo(() => {
    return records.filter(r => r.type === 'bill' || (r.billItems && r.billItems.length > 0) || r.billSummary);
  }, [records]);

  const metrics = useMemo(() => aggregateBillingMetrics(billingRecords), [billingRecords]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading financial records...</div>;
  }

  const categoryEntries = Object.entries(metrics.itemsByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Medical Billing & Expenses</h1>
        <p className="text-muted-foreground mt-1">Track your healthcare spending, insurance coverage, and itemized bills.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Total Billed</span>
          </div>
          <p className="text-3xl font-bold font-heading">
            ${metrics.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Building className="w-5 h-5 text-success" />
            <span className="text-sm font-medium">Insurance Covered</span>
          </div>
          <p className="text-3xl font-bold font-heading text-success">
            ${metrics.insuranceCovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.2 }} className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <DollarSign className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium">Patient Responsibility</span>
          </div>
          <p className="text-3xl font-bold font-heading text-destructive">
            ${metrics.patientResponsibility.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl p-5 shadow-sm h-full">
            <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Spend by Category
            </h3>
            {categoryEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No itemized data available.</p>
            ) : (
              <div className="space-y-4">
                {categoryEntries.map(([category, amount]) => {
                  const percentage = metrics.totalBilled > 0 ? (amount / metrics.totalBilled) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-muted-foreground">{category}</span>
                        <span className="font-bold">${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="font-heading font-bold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Recent Invoices
            </h3>
            {billingRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Upload hospital bills or invoices to see them here.</p>
            ) : (
              <div className="space-y-4">
                {billingRecords.map(record => (
                  <div key={record.id} className="border rounded-lg p-4 bg-background">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <h4 className="font-bold">{record.title}</h4>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Hospital className="w-3 h-3" /> {record.hospital || 'Unknown Provider'}</span>
                          <span>• {record.date ? new Date(record.date).toLocaleDateString() : 'Unknown Date'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          ${record.billSummary?.totalBilled?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || record.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                        </p>
                        {record.billSummary?.patientResponsibility !== undefined && (
                          <p className="text-xs text-destructive font-medium mt-0.5">
                            You pay: ${record.billSummary.patientResponsibility.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>

                    {record.billItems && record.billItems.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Itemized Breakdown</p>
                        <div className="space-y-2">
                          {record.billItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1.5 px-3 bg-muted/30 rounded-md">
                              <div>
                                <p className="font-medium">{item.description}</p>
                                {item.code && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Code: {item.code}</p>}
                              </div>
                              <p className="font-semibold">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
