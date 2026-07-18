/**
 * Shared guards for unauthenticated public proxy routes.
 * Prevents open-proxy abuse and upstream quota burn (security audit).
 */
import { checkRateLimit } from "./rateLimiter";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

/** 120 requests / minute / IP — generous for a single-user dashboard, tight against abuse. */
const DEFAULT_LIMIT = 120;
const DEFAULT_WINDOW_MS = 60_000;

export function publicApiJson(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

/** Returns a 429 Response when over limit, otherwise null (proceed). */
export function publicRateLimitResponse(request: Request, scope: string): Response | null {
  const rate = checkRateLimit(request, `public:${scope}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS);
  if (!rate.allowed) {
    return publicApiJson(
      { error: "rate_limited", message: "Too many requests — please slow down." },
      429,
      { "Retry-After": String(rate.retryAfterSec ?? 60) },
    );
  }
  return null;
}

export { CORS_HEADERS as PUBLIC_CORS_HEADERS };
