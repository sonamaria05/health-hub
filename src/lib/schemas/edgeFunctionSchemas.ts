import { z } from 'zod';

// Keep in sync with supabase/functions/_shared/schemas.ts.
// This client-side copy exists to fail fast with a friendly message before
// spending a network round-trip; the edge function re-validates
// independently and is the actual security boundary; a client-side check
// alone is never sufficient.

const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export const extractMedicalDataSchema = z.object({
  fileBase64: z.string().min(1, 'File is required').max(MAX_BASE64_LENGTH, 'File is too large (8MB max)'),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
});

export type ExtractMedicalDataInput = z.infer<typeof extractMedicalDataSchema>;
