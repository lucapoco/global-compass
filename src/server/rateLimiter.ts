/**
 * Minimal in-memory sliding-window rate limiter for public server routes.
 *
 * Security audit finding: `/api/ai-news-chat` and `/api/generate-report`
 * are unauthenticated (by design — no login system exists in this
 * educational project) but were previously completely unbounded, letting
 * anyone burn the shared `GEMINI_API_KEY` quota. This adds a per-IP request
 * cap without requiring any auth system or new user-facing functionality.
 *
 * Caveat: state is per-Worker-isolate (in-memory `Map`), so on a
 * multi-region/multi-isolate Cloudflare deployment this is a best-effort
 * deterrent, not a hard global guarantee. For strict enforcement, pair with
 * Cloudflare's edge Rate Limiting rules (dashboard-level, no code needed).
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Bound memory growth from long-running Worker isolates.
const MAX_TRACKED_KEYS = 5_000;

function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `${scope}:${ip}`;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/**
 * Sliding-window check: allows up to `limit` requests per `windowMs` for the
 * given request's client IP + `scope` (route identifier).
 */
export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const key = clientKey(request, scope);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Evict the oldest-inserted key to bound memory (approximate LRU).
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  return { allowed: true };
}
