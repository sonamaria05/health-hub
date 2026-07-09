import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  corsHeaders,
  enforceRateLimit,
  internalErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../_shared/http.ts";
import { extractMedicalDataSchema } from "../_shared/schemas.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return unauthorizedResponse("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return unauthorizedResponse();
    }

    const rateLimitResponse = await enforceRateLimit(supabase, req, "extract-medical-data", authData.user.id, {
      perUserMax: 20,
      perUserWindowSeconds: 600,
      perIpMax: 60,
      perIpWindowSeconds: 600,
    });
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Request body must be valid JSON");
    }

    const parsed = extractMedicalDataSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request payload", parsed.error.flatten());
    }
    const { fileBase64, fileName, mimeType } = parsed.data;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You extract structured medical report information from uploaded documents.

Return data by calling the extract_medical_data function.
Include:
- report type: blood_test, prescription, imaging, bill, or discharge_summary
- report title
- report date in YYYY-MM-DD
- doctor name
- hospital or lab name
- patient name when visible
- summary in 1-2 short sentences
- status: normal, attention, or critical
- extracted lab values with unit, normal range, and status
- amount if the report is a bill

If a field is unknown, return a reasonable empty or fallback value instead of inventing a diagnosis.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract medical report data from "${fileName}".`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "application/pdf"};base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_medical_data",
              description: "Extract structured report data from a medical document",
              parameters: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["blood_test", "prescription", "imaging", "bill", "discharge_summary"],
                  },
                  title: { type: "string" },
                  date: { type: "string", description: "YYYY-MM-DD format" },
                  doctor: { type: "string" },
                  hospital: { type: "string" },
                  patientName: { type: "string" },
                  summary: { type: "string" },
                  status: { type: "string", enum: ["normal", "attention", "critical"] },
                  extractedData: {
                    type: "object",
                    additionalProperties: {
                      type: "object",
                      properties: {
                        value: { type: "number" },
                        unit: { type: "string" },
                        normalRange: { type: "string" },
                        status: { type: "string", enum: ["normal", "high", "low"] },
                      },
                      required: ["value", "unit", "normalRange", "status"],
                    },
                  },
                  amount: { type: "number" },
                },
                required: ["type", "title", "date", "doctor", "hospital", "status"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_medical_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      // AI gateway status codes map reasonably onto our own response (e.g.
      // its 429 should still surface as a 429 to our client), but the body
      // is internal detail and is not forwarded.
      return jsonResponse({ error: "The document processing service is currently unavailable." }, response.status);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No structured data extracted from AI response");
    }

    const extractedRecord = JSON.parse(toolCall.function.arguments);
    const mlFeatures: Record<string, number> = {};

    if (extractedRecord.extractedData) {
      for (const [key, data] of Object.entries(extractedRecord.extractedData)) {
        const item = data as { value: number; status: string };
        mlFeatures[key] = item.value;
        mlFeatures[`${key}_status`] = item.status === "normal" ? 0 : item.status === "high" ? 1 : -1;
      }
    }

    const mlLabels: Record<string, number> = {
      is_attention: extractedRecord.status === "attention" ? 1 : 0,
      is_critical: extractedRecord.status === "critical" ? 1 : 0,
    };

    return jsonResponse({
      record: {
        ...extractedRecord,
        processingStatus: "processed",
      },
      mlData: { features: mlFeatures, labels: mlLabels },
    }, 200);
  } catch (error) {
    return internalErrorResponse("extract-medical-data error", error);
  }
});
