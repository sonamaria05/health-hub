import { describe, it, expect } from 'vitest';
import { extractMedicalDataSchema } from '@/lib/schemas/edgeFunctionSchemas';

describe('extractMedicalDataSchema', () => {
  it('accepts a valid payload', () => {
    const result = extractMedicalDataSchema.safeParse({
      fileBase64: 'abc123',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty fileBase64', () => {
    const result = extractMedicalDataSchema.safeParse({
      fileBase64: '',
      fileName: 'report.pdf',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing fileName', () => {
    const result = extractMedicalDataSchema.safeParse({
      fileBase64: 'abc123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload over the 8MB base64 cap', () => {
    const result = extractMedicalDataSchema.safeParse({
      fileBase64: 'a'.repeat(8 * 1024 * 1024 + 1),
      fileName: 'report.pdf',
    });
    expect(result.success).toBe(false);
  });

  it('allows mimeType to be omitted', () => {
    const result = extractMedicalDataSchema.safeParse({
      fileBase64: 'abc123',
      fileName: 'report.pdf',
    });
    expect(result.success).toBe(true);
  });
});
