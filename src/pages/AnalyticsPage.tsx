import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { useRecords } from '@/lib/RecordsContext';
import { baseMetrics, buildChartData, collectLatestParameters } from '@/lib/healthInsights';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton, ChartCardSkeleton } from '@/components/skeletons/PageSkeletons';
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle, Info, Minus } from 'lucide-react';

const metricDescriptions: Record<string, string> = {
  hemoglobin: 'Hemoglobin is the iron-rich protein in red blood cells that carries oxygen from your lungs to the rest of your body.',
  wbc: 'Total White Blood Cell (WBC) count reflects immune defense, acute infection, physical inflammation, and bone marrow cellular production.',
  platelets: 'Platelets are vital cell fragments essential for hemostasis, clot formation, and preventing internal or mucosal bleeding.',
  rbc: 'Red Blood Cell (RBC) count evaluates total circulating erythrocytes delivering oxygen to tissues throughout the body.',
  neutrophils: 'Neutrophils are the primary white blood cells that fight acute bacterial infections and respond rapidly to inflammation.',
  lymphocytes: 'Lymphocytes are adaptive immune cells responsible for humoral antibody production and cellular viral defense.',
  pcv: 'Packed Cell Volume (PCV/Hematocrit) measures the percentage of whole blood comprised of red blood cells.',
  mcv: 'Mean Corpuscular Volume (MCV) evaluates red blood cell size to differentiate microcytic (iron deficiency) vs macrocytic anemias.',
  glucose: 'Fasting blood glucose measures your blood sugar levels after an overnight fast to screen for prediabetes and diabetes.',
  cholesterol: 'Total cholesterol measures the overall amount of cholesterol in your blood, including LDL, HDL, and VLDL particles.',
  creatinine: 'Creatinine is a waste product filtered by the kidneys; elevated levels can indicate decreased renal filtration efficiency.',
  hba1c: 'HbA1c reflects your average blood sugar level over the past 2 to 3 months and is a key indicator of long-term glycemic control.',
  ldl: 'Low-density lipoprotein (LDL) is "bad" cholesterol that can accumulate in blood vessel walls and increase cardiovascular risk.',
  triglycerides: 'Triglycerides are the most common type of fat in your body, storing excess calories and contributing to artery health.',
  tsh: 'Thyroid Stimulating Hormone (TSH) regulates metabolic rate, energy balance, and thyroid hormone production.',
  vitamin_d: 'Vitamin D (25-OH) is essential for calcium absorption, bone mineralization, neuromuscular function, and immune defense.',
};

export default function AnalyticsPage() {
  const { records, isDemoData, loading } = useRecords();
  const [selectedMetric, setSelectedMetric] = useState(0);

  const chartData = useMemo(() => buildChartData(records), [records]);
  const extractedParams = useMemo(() => collectLatestParameters(records), [records]);
  const metric = baseMetrics[selectedMetric];

  const latestMetricData = [...chartData].reverse().find(point => point[metric.key] != null);
  const previousMetricData = [...chartData]
    .slice(0, latestMetricData ? chartData.indexOf(latestMetricData) : 0)
    .reverse()
    .find(point => point[metric.key] != null);

  const latestValue = latestMetricData?.[metric.key] as number | undefined;
  const previousValue = previousMetricData?.[metric.key] as number | undefined;
  const change = latestValue != null && previousValue != null ? latestValue - previousValue : 0;
  const isInRange = latestValue != null ? latestValue >= metric.normalMin && latestValue <= metric.normalMax : true;

  const metricValues = useMemo(() => {
    return chartData
      .map(point => point[metric.key])
      .filter((v): v is number => typeof v === 'number');
  }, [chartData, metric.key]);

  const minValue = metricValues.length > 0 ? Math.min(...metricValues) : null;
  const maxValue = metricValues.length > 0 ? Math.max(...metricValues) : null;
  const avgValue = metricValues.length > 0 ? (metricValues.reduce((a, b) => a + b, 0) / metricValues.length).toFixed(1) : null;

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <ChartCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Health Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your health parameters over time using the data extracted from your reports.</p>
        {isDemoData && (
          <div className="mt-3">
            <Badge variant="secondary">Demo Data</Badge>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {baseMetrics.map((item, index) => (
          <button
            key={item.key}
            onClick={() => setSelectedMetric(index)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border
              ${index === selectedMetric ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: item.color }} />
            {item.label.split(' (')[0]}
          </button>
        ))}
      </div>

      {latestValue != null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            key={`latest-${metric.key}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <p className="text-xs text-muted-foreground">Latest Value</p>
            <p className={`text-3xl font-heading font-bold mt-1 ${isInRange ? 'text-success' : 'text-warning'}`}>
              {latestValue}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isInRange ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {isInRange ? 'In Range' : 'Out of Range'}
              </span>
              {change !== 0 && (
                <span className="text-xs text-muted-foreground flex items-center">
                  {change > 0 ? <ArrowUpRight className="w-3 h-3 text-warning" /> : <ArrowDownRight className="w-3 h-3 text-success" />}
                  {Math.abs(change).toFixed(1)}
                </span>
              )}
            </div>
          </motion.div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground">Normal Target Range</p>
            <p className="text-2xl font-heading font-bold mt-1">{metric.normalMin} – {metric.normalMax}</p>
            <p className="text-xs text-muted-foreground mt-2">{metric.label.split('(')[1]?.replace(')', '') || ''}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground">Recorded Range</p>
            <p className="text-2xl font-heading font-bold mt-1">{minValue} – {maxValue}</p>
            <p className="text-xs text-muted-foreground mt-2">Min: {minValue} | Max: {maxValue}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground">Historical Average</p>
            <p className="text-2xl font-heading font-bold mt-1">{avgValue}</p>
            <p className="text-xs text-muted-foreground mt-2">Across {metricValues.length} recorded tests</p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-heading font-semibold">Trend Over Time — {metric.label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Reference lines indicate standard clinical target thresholds.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block" /> Biomarker Level</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-destructive border-dashed border-t border-destructive inline-block" /> Limit Threshold</span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Upload reports with extracted lab values to unlock trend charts here.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: 12 }} />
              {metric.normalMax && (
                <ReferenceLine y={metric.normalMax} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `Max: ${metric.normalMax}`, fill: 'hsl(var(--destructive))', fontSize: 10, position: 'insideTopRight' }} />
              )}
              {metric.normalMin > 0 && (
                <ReferenceLine y={metric.normalMin} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: `Min: ${metric.normalMin}`, fill: 'hsl(var(--success))', fontSize: 10, position: 'insideBottomRight' }} />
              )}
              <Area type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2.5} fill="url(#colorGrad)" dot={{ fill: metric.color, r: 4 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {metricDescriptions[metric.key] && (
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>{metricDescriptions[metric.key]}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading font-semibold mb-3">Latest Extracted Parameters</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Object.entries(extractedParams).map(([key, value]) => (
            <div key={key} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground truncate">{key}</p>
              <p className={`text-lg font-heading font-bold mt-1 ${value.status === 'normal' ? 'text-success' : value.status === 'high' ? 'text-destructive' : 'text-warning'}`}>
                {value.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{value.unit} | {value.status}</p>
            </div>
          ))}
          {Object.keys(extractedParams).length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-6">Upload reports with lab values to see parameter summaries here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
