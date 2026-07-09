import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { predictHealthRisksFromSnapshot } from "../../../src/lib/mlRisk.ts";
import {
  corsHeaders,
  enforceRateLimit,
  internalErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../_shared/http.ts";
import { predictHealthRisksSchema } from "../_shared/schemas.ts";

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

    const rateLimitResponse = await enforceRateLimit(supabase, req, "predict-health-risks", authData.user.id, {
      perUserMax: 30,
      perUserWindowSeconds: 600,
      perIpMax: 90,
      perIpWindowSeconds: 600,
    });
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Request body must be valid JSON");
    }

    const parsed = predictHealthRisksSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request payload", parsed.error.flatten());
    }

    const predictions = predictHealthRisksFromSnapshot(parsed.data.featureSnapshot);
    const modelVersion = predictions[0]?.modelVersion ?? "demo-logreg-v1";

    return jsonResponse({
      predictions,
      source: "backend_model",
      modelVersion,
    }, 200);
  } catch (error) {
    return internalErrorResponse("predict-health-risks error", error);
  }
});
