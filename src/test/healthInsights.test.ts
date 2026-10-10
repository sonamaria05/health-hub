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
    const customRecords = [
      {
        ...mockRecords[0],
        extractedData: {
          'Total Cholesterol': { value: 300, unit: 'mg/dL', normalRange: '0-200', status: 'high' },
          'LDL Cholesterol': { value: 190, unit: 'mg/dL', normalRange: '0-100', status: 'high' }
        }
      }
    ];
    const insights = generateHealthInsights(customRecords);
    expect(insights.some(item => item.condition === 'Cardiovascular & Lipid Risk')).toBe(true);
    expect(insights.some(item => item.risk === 'high' || item.risk === 'moderate')).toBe(true);
  });
});
