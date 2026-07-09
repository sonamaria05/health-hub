import { z } from "https://esm.sh/zod@3.23.8";

// Keep in sync with src/lib/schemas/edgeFunctionSchemas.ts on the frontend.

// 8MB base64 is roughly 6MB of original file content - generous for a
// scanned medical report, but bounded so a client can't send an
// arbitrarily large payload that ties up function memory/CPU or racks up
// AI gateway cost.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export const extractMedicalDataSchema = z.object({
  fileBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
});

export type ExtractMedicalDataInput = z.infer<typeof extractMedicalDataSchema>;

const extractedMetricSchema = z.object({
  value: z.number(),
  unit: z.string().max(50),
  normalRange: z.string().max(100),
  status: z.enum(["normal", "high", "low"]),
});

export const predictHealthRisksSchema = z.object({
  featureSnapshot: z.object({
    date: z.string().optional(),
    extractedData: z.record(z.string(), extractedMetricSchema).optional(),
  }).passthrough(),
});

export type PredictHealthRisksInput = z.infer<typeof predictHealthRisksSchema>;
