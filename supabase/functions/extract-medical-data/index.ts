import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized request" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, fileName, mimeType } = await req.json();

    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: "fileBase64 and fileName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({
      record: {
        ...extractedRecord,
        processingStatus: "processed",
      },
      mlData: { features: mlFeatures, labels: mlLabels },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-medical-data error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
