import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useRecords } from '@/lib/RecordsContext';
import { baseMetrics, buildChartData, collectLatestParameters } from '@/lib/healthInsights';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardSkeleton, ChartCardSkeleton } from '@/components/skeletons/PageSkeletons';

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
        <motion.div
          key={metric.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-xl p-6 flex items-center gap-6"
        >
          <div>
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className={`text-4xl font-heading font-bold mt-1 ${isInRange ? 'text-success' : 'text-warning'}`}>
              {latestValue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Normal: {metric.normalMin}-{metric.normalMax} | Change: {change > 0 ? '+' : ''}{change.toFixed(2)}
            </p>
          </div>
          <div className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium ${isInRange ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
            {isInRange ? 'In Range' : 'Out of Range'}
          </div>
        </motion.div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold mb-4">Trend Over Time</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Upload reports with extracted lab values to unlock trend charts here.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 15% 88%)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(200 10% 50%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(200 10% 50%)" domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(200 15% 88%)', fontSize: 12 }} />
              <Area type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2.5} fill="url(#colorGrad)" dot={{ fill: metric.color, r: 4 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
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
