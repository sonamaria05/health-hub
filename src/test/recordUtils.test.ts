import { describe, expect, it } from 'vitest';
import { buildRecordSummary, deriveRecordStatus, validateUploadFile } from '@/lib/recordUtils';
import { mockRecords } from '@/lib/mockData';

describe('record utilities', () => {
  it('accepts supported text uploads', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(validateUploadFile(file)).toBeNull();
  });

  it('derives attention status from abnormal extracted data', () => {
    const status = deriveRecordStatus(mockRecords[0].extractedData);
    expect(['attention', 'critical']).toContain(status);
  });

  it('builds a useful summary for bills', () => {
    const billRecord = mockRecords.find((record) => record.type === 'bill' && record.amount);
    expect(billRecord).toBeDefined();
    const summary = buildRecordSummary(billRecord!);
    expect(summary).toContain('Rs.');
  });
});
