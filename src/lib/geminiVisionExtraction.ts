import { MedicalRecord } from './mockData';
import { buildRecordSummary, deriveRecordStatus } from './recordUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType = 'prescription' | 'pharmacy_bill' | 'hospital_bill' | 'lab_report';

const CONFIDENCE_THRESHOLD = 0.7;

interface FieldWithConfidence {
  value: string | number | null;
  confidence: number;
}

interface GeminiExtractionResponse {
  docType?: string;                            // returned by combined prompt
  type?: MedicalRecord['type'];
  title?: FieldWithConfidence | string;
  date?: FieldWithConfidence | string;
  doctor?: FieldWithConfidence | string;
  hospital?: FieldWithConfidence | string;
  patientName?: FieldWithConfidence | string;
  summary?: string;
  status?: 'normal' | 'attention' | 'critical';
  extractedData?: Record<string, {
    value: number | string;
    unit: string;
    normalRange: string;
    status: 'normal' | 'high' | 'low';
    confidence?: number;
  }>;
  amount?: number | FieldWithConfidence;
  medications?: Array<{
    name: FieldWithConfidence | string;
    dosage: FieldWithConfidence | string;
    frequency?: FieldWithConfidence | string;
    duration?: FieldWithConfidence | string;
    instructions?: FieldWithConfidence | string;
  }>;
  billItems?: Array<{
    description: FieldWithConfidence | string;
    category?: FieldWithConfidence | string;
    amount: FieldWithConfidence | number;
    cptCode?: FieldWithConfidence | string;
    icdCode?: FieldWithConfidence | string;
  }>;
  billSummary?: {
    totalBilled: FieldWithConfidence | number;
    insuranceCovered?: FieldWithConfidence | number;
    patientResponsibility?: FieldWithConfidence | number;
    discount?: FieldWithConfidence | number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveField(f: FieldWithConfidence | string | number | undefined): {
  value: string | number | undefined;
  confidence: number;
} {
  if (f === undefined || f === null) return { value: undefined, confidence: 1 };
  if (typeof f === 'object' && 'value' in f) {
    return { value: f.value ?? undefined, confidence: f.confidence ?? 1 };
  }
  return { value: f as string | number, confidence: 1 };
}

export function needsReview(geminiConf: number, ocrConf: number): boolean {
  return geminiConf < CONFIDENCE_THRESHOLD || ocrConf < CONFIDENCE_THRESHOLD;
}

// FIX 2: Parse dosage strings like "500mg", "1 tablet", "10 mL" → { num, unit }
function parseDosage(raw: string | number | null | undefined): { value: number; unit: string } {
  if (raw === null || raw === undefined) return { value: 0, unit: '' };
  if (typeof raw === 'number') return { value: raw, unit: '' };
  const str   = String(raw).trim();
  const match = str.match(/^([\d.]+)\s*(.*)$/);
  if (match) {
    const num = parseFloat(match[1]);
    return { value: isNaN(num) ? 0 : num, unit: match[2].trim() };
  }
  return { value: 0, unit: str };
}

// ─── Model list ──────────────────────────────────────────────────────────────

const MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
];

// FIX 4: Add maxOutputTokens to prevent truncation
async function callGemini(
  prompt: string,
  base64: string,
  mimeType: string,
  apiKey: string,
  temperature = 0.1
): Promise<string> {
  const cleanKey  = apiKey.trim().replace(/^["']|["']$/g, '');
  const cleanMime = mimeType.startsWith('image/') ? mimeType : 'image/png';

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: cleanMime, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,    // FIX 4: prevent response truncation
    },
  };

  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          console.debug(`[Gemini] ✓ ${model}`);
          return text;
        }
      } else {
        const errText = await res.text();
        console.warn(`[Gemini] ${model} → ${res.status}:`, errText);
        lastError = new Error(`${model}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[Gemini] ${model} fetch failed:`, err);
      lastError = err as Error;
    }
  }

  throw lastError ?? new Error('All Gemini models failed to return content.');
}

// FIX 4: Robust JSON repair — handles trailing commas, truncation, markdown fences
function safeParseJson(raw: string): GeminiExtractionResponse {
  // 1. Strip markdown fences
  let cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // 2. Try direct parse first
  try { return JSON.parse(cleaned) as GeminiExtractionResponse; } catch { /* continue */ }

  // 3. Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(cleaned) as GeminiExtractionResponse; } catch { /* continue */ }

  // 4. Truncation recovery — find last complete key-value pair and close the object
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), 0);
  cleaned = cleaned.substring(0, lastBrace + 1);
  // Balance braces
  const opens  = (cleaned.match(/\{/g) ?? []).length;
  const closes = (cleaned.match(/\}/g) ?? []).length;
  cleaned += '}'.repeat(Math.max(0, opens - closes));
  try { return JSON.parse(cleaned) as GeminiExtractionResponse; } catch { /* continue */ }

  // 5. Give up — return empty shell
  console.error('[Gemini] Could not parse JSON response:', raw.slice(0, 200));
  return {};
}

// ─── FIX 9: Combined classify + extract prompt ────────────────────────────────
// Single Gemini call: first detects type, then extracts with the right schema.
// This halves latency and eliminates one entire failure point.

const COMBINED_PROMPT = `You are an expert medical document analyzer.

STEP 1 — Identify the document type. Choose ONE of:
  "prescription"   – doctor's prescription / clinical note
  "pharmacy_bill"  – pharmacy receipt / medicine purchase bill
  "hospital_bill"  – hospital / clinic invoice or discharge bill
  "lab_report"     – laboratory test results / pathology report

STEP 2 — Extract ALL data from the image into the JSON schema for that type (shown below).

RULES:
• Return PURE JSON only — no markdown, no backticks, no comments.
• For every text/date/name field use: {"value": <text or null>, "confidence": <0.0–1.0>}
• confidence reflects how clearly readable the field is in the image.
• Use null for fields that are absent or completely illegible.
• For illegible fields, still give your best-guess with low confidence (0.2–0.5).
• NEVER omit a field from the schema — always include it even if null.
• For normalRange ALWAYS use "min-max" format (e.g. "12-16"). For one-sided ranges like ">4000" write "4000-999999". For qualitative, write "N/A".
• Calculate status (low/normal/high) by checking if value is inside the normalRange.
• For lab_report: extract EVERY SINGLE parameter visible — do not skip any row.

OUTPUT FORMAT (choose the schema matching the document type):

=== IF lab_report ===
{
  "docType": "lab_report",
  "type": "blood_test",
  "title":       {"value": "<exact report title>", "confidence": 0.0},
  "date":        {"value": "YYYY-MM-DD or null", "confidence": 0.0},
  "doctor":      {"value": "<referring doctor or null>", "confidence": 0.0},
  "hospital":    {"value": "<lab / diagnostic centre name>", "confidence": 0.0},
  "patientName": {"value": "<patient full name>", "confidence": 0.0},
  "summary": "1-2 sentences: overall findings and any abnormal values",
  "extractedData": {
    "<parameter name>": {
      "value": <exact numeric value as number>,
      "unit": "<unit string>",
      "normalRange": "<min-max format, e.g. 12-16>",
      "status": "normal|high|low",
      "confidence": 0.0
    }
  }
}

=== IF prescription ===
{
  "docType": "prescription",
  "type": "prescription",
  "title":       {"value": "<clinic/doctor + Prescription>", "confidence": 0.0},
  "date":        {"value": "YYYY-MM-DD or null", "confidence": 0.0},
  "doctor":      {"value": "<full doctor name>", "confidence": 0.0},
  "hospital":    {"value": "<clinic or hospital name>", "confidence": 0.0},
  "patientName": {"value": "<patient full name>", "confidence": 0.0},
  "summary": "1-sentence summary of what was prescribed",
  "medications": [
    {
      "name":         {"value": "<drug name>", "confidence": 0.0},
      "dosage":       {"value": "<e.g. 500mg, 10ml, 1 tablet>", "confidence": 0.0},
      "frequency":    {"value": "<e.g. Twice daily, BID, Every 8 hours>", "confidence": 0.0},
      "duration":     {"value": "<e.g. 5 days, 1 month>", "confidence": 0.0},
      "instructions": {"value": "<e.g. After meals, Before sleep>", "confidence": 0.0}
    }
  ]
}

=== IF pharmacy_bill OR hospital_bill ===
{
  "docType": "hospital_bill",
  "type": "bill",
  "title":       {"value": "<hospital/pharmacy name + Bill>", "confidence": 0.0},
  "date":        {"value": "YYYY-MM-DD or null", "confidence": 0.0},
  "doctor":      {"value": "<treating doctor or null>", "confidence": 0.0},
  "hospital":    {"value": "<hospital or pharmacy name>", "confidence": 0.0},
  "patientName": {"value": "<patient name>", "confidence": 0.0},
  "summary": "1-sentence summary of charges",
  "billItems": [
    {
      "description": {"value": "<procedure, test, room charge, or medicine name>", "confidence": 0.0},
      "category":    {"value": "<e.g. Pharmacy, Consultation, Procedure, Room, Lab>", "confidence": 0.0},
      "amount":      {"value": <amount as number>, "confidence": 0.0},
      "cptCode":     {"value": "<CPT/Procedure code if present, else null>", "confidence": 0.0},
      "icdCode":     {"value": "<ICD/Diagnosis code if present, else null>", "confidence": 0.0}
    }
  ],
  "billSummary": {
    "totalBilled":           {"value": <total billed amount as number>, "confidence": 0.0},
    "insuranceCovered":      {"value": <amount covered by insurance as number or null>, "confidence": 0.0},
    "patientResponsibility": {"value": <amount patient has to pay as number or null>, "confidence": 0.0},
    "discount":              {"value": <discount amount as number or null>, "confidence": 0.0}
  }
}`;

// ─── Export: kept for backward compat (documentProcessing.ts imports it) ─────
export async function classifyDocumentType(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<DocumentType> {
  // No-op: classification is now done inside extractWithGeminiVision (combined call)
  // This function is kept so existing import doesn't break
  console.debug('[classifyDocumentType] Skipped — using combined prompt');
  return 'lab_report';
}

// ─── Main extraction function (FIX 9: single combined call) ──────────────────

export async function extractWithGeminiVision(
  fileBase64: string,
  mimeType: string,
  apiKey: string,
  docType?: string,           // ignored — type detected by combined prompt
  ocrConfidence = 1.0
): Promise<Partial<MedicalRecord>> {

  const rawText = await callGemini(COMBINED_PROMPT, fileBase64, mimeType, apiKey, 0.1);
  const parsed  = safeParseJson(rawText);                   // FIX 4: robust parse

  const detectedDocType = (parsed.docType ?? docType ?? 'lab_report') as DocumentType;
  console.debug(`[extractWithGeminiVision] Detected type: ${detectedDocType}`);

  // ── Resolve top-level fields ──
  const title       = resolveField(parsed.title);
  const date        = resolveField(parsed.date);
  const doctor      = resolveField(parsed.doctor);
  const hospital    = resolveField(parsed.hospital);
  const patientName = resolveField(parsed.patientName);
  const amountField = resolveField(parsed.amount as FieldWithConfidence | number | undefined);

  // ── Build extractedData with needs_review flags ──
  const rawData     = parsed.extractedData ?? {};
  const extractedData: MedicalRecord['extractedData'] = {};

  for (const [key, metric] of Object.entries(rawData)) {
    const gConf = metric.confidence ?? 1;
    // Ensure numeric value
    const numVal = typeof metric.value === 'number'
      ? metric.value
      : parseFloat(String(metric.value ?? '0')) || 0;

    extractedData[key] = {
      value:        numVal,
      unit:         metric.unit,
      normalRange:  metric.normalRange,
      status:       metric.status,
      confidence:   gConf,
      needs_review: needsReview(gConf, ocrConfidence) ? true : undefined,
    };
  }

  const derivedStatus = deriveRecordStatus(extractedData);

  const topLevelNeedsReview =
    needsReview(title.confidence, ocrConfidence) ||
    needsReview(date.confidence, ocrConfidence)  ||
    needsReview(doctor.confidence, ocrConfidence);

  const record: Partial<MedicalRecord> = {
    type:        (parsed.type as MedicalRecord['type']) ?? 'blood_test',
    title:       String(title.value ?? 'Medical Document'),
    date:        date.value ? String(date.value) : '',
    doctor:      String(doctor.value ?? 'Auto-Detected'),
    hospital:    String(hospital.value ?? 'Uploaded by Patient'),
    patientName: patientName.value ? String(patientName.value) : undefined,
    summary:     parsed.summary ?? buildRecordSummary({
      type:     (parsed.type as MedicalRecord['type']) ?? 'blood_test',
      doctor:   String(doctor.value ?? ''),
      hospital: String(hospital.value ?? ''),
      extractedData,
    } as MedicalRecord),
    extractedData,
    status:      derivedStatus,
  };

  // Add medications if present
  if (detectedDocType === 'prescription' && parsed.medications?.length) {
    record.medications = parsed.medications.map(med => {
      const name = resolveField(med.name);
      const dosage = resolveField(med.dosage);
      const freq = resolveField(med.frequency);
      const dur = resolveField(med.duration);
      const inst = resolveField(med.instructions);
      return {
        name: String(name.value || ''),
        dosage: String(dosage.value || ''),
        frequency: String(freq.value || ''),
        duration: String(dur.value || ''),
        instructions: String(inst.value || '')
      };
    }).filter(m => m.name);
  }

  // Add billing if present
  if ((detectedDocType === 'hospital_bill' || detectedDocType === 'pharmacy_bill') && parsed.billItems?.length) {
    record.billItems = parsed.billItems.map(item => ({
      description: String(resolveField(item.description).value || ''),
      category: String(resolveField(item.category).value || ''),
      amount: Number(resolveField(item.amount).value || 0),
      cptCode: String(resolveField(item.cptCode).value || ''),
      icdCode: String(resolveField(item.icdCode).value || '')
    })).filter(i => i.description);

    if (parsed.billSummary) {
      record.billSummary = {
        totalBilled: Number(resolveField(parsed.billSummary.totalBilled).value || 0),
        insuranceCovered: resolveField(parsed.billSummary.insuranceCovered).value ? Number(resolveField(parsed.billSummary.insuranceCovered).value) : undefined,
        patientResponsibility: resolveField(parsed.billSummary.patientResponsibility).value ? Number(resolveField(parsed.billSummary.patientResponsibility).value) : undefined,
        discount: resolveField(parsed.billSummary.discount).value ? Number(resolveField(parsed.billSummary.discount).value) : undefined,
      };
      // fallback for legacy `amount` field compatibility on root level
      record.amount = record.billSummary.totalBilled;
    } else {
      record.amount = typeof amountField.value === 'number' ? amountField.value : undefined;
    }
  }

  record.processingStatus =
    topLevelNeedsReview || Object.values(extractedData).some(f => f.needs_review)
      ? 'needs_review'
      : (Object.keys(extractedData).length > 0 || record.medications?.length || record.billItems?.length)
        ? 'processed'
        : 'needs_review';

  return record;
}
