import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  enforceRateLimit,
  internalErrorResponse,
  jsonResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../_shared/http.ts";

// Require an explicit confirmation string rather than an empty POST, so a
// stray/automated request can't silently trigger an irreversible deletion.
const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE MY ACCOUNT"),
});

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // User-scoped client: used only to identify who's asking and to list
    // their own files (RLS still applies here, so this alone can't be used
    // to touch anyone else's data even if something above it were wrong).
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return unauthorizedResponse();
    }
    const userId = authData.user.id;
    const userEmail = authData.user.email ?? "";

    const rateLimitResponse = await enforceRateLimit(userClient, req, "delete-account", userId, {
      perUserMax: 3,
      perUserWindowSeconds: 3600,
      perIpMax: 10,
      perIpWindowSeconds: 3600,
    });
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Request body must be valid JSON");
    }
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(
        'Type "DELETE MY ACCOUNT" exactly to confirm this irreversible action.',
        parsed.error.flatten(),
      );
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Best-effort cleanup of storage files - these aren't covered by the
    // Postgres ON DELETE CASCADE chain since storage.objects isn't FK-linked
    // to our tables. A failure here is logged but must not block account
    // deletion itself; an orphaned file with no owning account is a much
    // smaller problem than being unable to delete the account at all.
    try {
      const { data: files } = await adminClient.storage.from("medical-reports").list(userId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await adminClient.storage.from("medical-reports").remove(paths);
      }
    } catch (storageError) {
      console.error("Error cleaning up storage during account deletion:", storageError);
    }

    // Best-effort: login_attempts is keyed by email, not a FK to auth.users,
    // so it isn't covered by CASCADE either.
    try {
      await adminClient.from("login_attempts").delete().eq("email", userEmail.toLowerCase());
    } catch (loginAttemptsError) {
      console.error("Error cleaning up login_attempts during account deletion:", loginAttemptsError);
    }

    // Deleting the auth.users row cascades to profiles, medical_records,
    // ml_training_datasets, and user_roles via their ON DELETE CASCADE
    // foreign keys. audit_log rows are preserved with user_id set to NULL
    // (ON DELETE SET NULL) - the audit trail's own integrity is a security
    // property independent of whether the account still exists.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return jsonResponse({ deleted: true }, 200);
  } catch (error) {
    return internalErrorResponse("delete-account error", error);
  }
});
