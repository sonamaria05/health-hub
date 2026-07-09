// Shared helpers for Supabase Edge Functions.
// Keeping this consistent across functions is what lets us guarantee
// "structured error JSON, correct status codes, no leaked internals" as a
// blanket property instead of re-deriving it per function.

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Vary": "Origin",
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** 400 with a machine-checkable `error` string and optional Zod-style field issues. */
export function validationErrorResponse(message: string, issues?: unknown): Response {
  return jsonResponse({ error: message, issues }, 400);
}

export function unauthorizedResponse(message = "Unauthorized request"): Response {
  return jsonResponse({ error: message }, 401);
}

export function forbiddenResponse(message = "Forbidden"): Response {
  return jsonResponse({ error: message }, 403);
}

export function rateLimitedResponse(message = "Too many requests. Please slow down and try again shortly."): Response {
  return jsonResponse({ error: message }, 429);
}

/**
 * 500 handler that logs the real error server-side (visible in Supabase's
 * function logs) but returns only a generic message to the client - never
 * a stack trace or raw exception message, which could leak internal
 * implementation details.
 */
export function internalErrorResponse(context: string, error: unknown): Response {
  console.error(`${context}:`, error);
  return jsonResponse({ error: "An unexpected error occurred. Please try again." }, 500);
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

/**
 * Enforces per-user AND per-IP rate limits via the Postgres-backed token
 * bucket (public.check_rate_limit). Returns null if the request is allowed,
 * or a ready-to-return 429 Response if it should be rejected.
 */
export async function enforceRateLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  req: Request,
  functionName: string,
  userId: string,
  opts: { perUserMax: number; perUserWindowSeconds: number; perIpMax: number; perIpWindowSeconds: number },
): Promise<Response | null> {
  const ip = getClientIp(req);

  const { data: userAllowed, error: userErr } = await supabase.rpc("check_rate_limit", {
    _bucket_key: `${functionName}:user:${userId}`,
    _max_requests: opts.perUserMax,
    _window_seconds: opts.perUserWindowSeconds,
  });
  if (userErr) {
    // Fail open on infra errors - an outage in the rate limiter must not
    // take down the whole feature. The auth + RLS checks remain in force.
    console.error("Rate limit check (user) failed:", userErr);
  } else if (userAllowed === false) {
    return rateLimitedResponse();
  }

  const { data: ipAllowed, error: ipErr } = await supabase.rpc("check_rate_limit", {
    _bucket_key: `${functionName}:ip:${ip}`,
    _max_requests: opts.perIpMax,
    _window_seconds: opts.perIpWindowSeconds,
  });
  if (ipErr) {
    console.error("Rate limit check (ip) failed:", ipErr);
  } else if (ipAllowed === false) {
    return rateLimitedResponse();
  }

  return null;
}
