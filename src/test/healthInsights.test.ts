import { describe, expect, it } from 'vitest';
import { buildChartData, collectLatestParameters, generateHealthInsights } from '@/lib/healthInsights';
import { mockRecords } from '@/lib/mockData';

describe('health insights helpers', () => {
  it('builds chart points from extracted records only', () => {
    const data = buildChartData(mockRecords);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every(point => Object.keys(point).length > 1)).toBe(true);
  });

  it('collects latest parameter values', () => {
    const params = collectLatestParameters(mockRecords);
    expect(params.Hemoglobin?.value).toBe(11.2);
    expect(params.HbA1c?.value).toBe(5.6);
  });

  it('generates health insights with corrected risk ordering', () => {
    const insights = generateHealthInsights(mockRecords);
    expect(insights.some(item => item.condition === 'Cardiovascular Risk')).toBe(true);
    expect(insights.some(item => item.risk === 'high' || item.risk === 'moderate')).toBe(true);
  });
});
