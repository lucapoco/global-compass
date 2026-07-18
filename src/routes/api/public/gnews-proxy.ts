import { createFileRoute } from "@tanstack/react-router";
import { publicApiJson, publicRateLimitResponse, PUBLIC_CORS_HEADERS } from "@/server/publicApiGuard";

/**
 * Server-side GNews proxy.
 *
 * The browser cannot reliably reach gnews.io directly from the Lovable
 * preview (ad-blockers, network policies, CORS quirks). This proxy:
 *   - reads the API key from server-only env (`GNEWS_API_KEY` — never use VITE_ prefix)
 *   - forwards a sanitized set of query params to GNews (`max` clamped 1–50, default 25)
 *   - returns normalized JSON with proper CORS headers
 *   - maps upstream 401/403/429/network errors to readable JSON responses
 */

function json(body: unknown, status = 200) {
  return publicApiJson(body, status);
}

function readKey(): string | undefined {
  const key = process.env.GNEWS_API_KEY ?? (globalThis as { GNEWS_API_KEY?: string }).GNEWS_API_KEY;
  return typeof key === "string" ? key.trim() : undefined;
}

function safeMessage(raw: string, key: string | undefined): string {
  return key ? raw.replaceAll(key, "***") : raw;
}

export const Route = createFileRoute("/api/public/gnews-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS }),
      GET: async ({ request }) => {
        const limited = publicRateLimitResponse(request, "gnews-proxy");
        if (limited) return limited;

        const key = readKey();
        if (!key) {
          return json({ error: "not_configured", message: "GNews API key is not set on the server." }, 500);
        }

        const url = new URL(request.url);
        const q = url.searchParams;

        // GNews free plans often cap articles per request (~10). We still accept up to 50
        // so paid tiers / future upgrades work; the frontend merges categories when needed.
        const maxParam = Number(q.get("max"));
        const max = Math.min(Math.max(Number.isFinite(maxParam) && maxParam > 0 ? maxParam : 25, 1), 50);

        const params = new URLSearchParams({
          category: (q.get("category") || "general").slice(0, 32),
          lang: (q.get("lang") || "en").slice(0, 8),
          country: (q.get("country") || "us").slice(0, 8),
          max: String(max),
          apikey: key,
        });
        const search = q.get("q");
        if (search) params.set("q", search.slice(0, 200));

        const upstream = `https://gnews.io/api/v4/top-headlines?${params.toString()}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal });
          clearTimeout(timer);

          if (res.status === 401) return json({ error: "invalid_key", message: "GNews API key is invalid." }, 401);
          if (res.status === 403) return json({ error: "quota_reached", message: "GNews daily quota reached." }, 403);
          if (res.status === 429) return json({ error: "rate_limited", message: "GNews rate limit reached. Try again shortly." }, 429);

          if (!res.ok) {
            let detail = "";
            try {
              const j = await res.json();
              detail = j?.errors?.[0] ?? j?.message ?? "";
            } catch {
              // upstream error body wasn't valid JSON — fall back to the plain status code
            }
            return json({ error: "upstream_error", status: res.status, message: `GNews ${res.status}${detail ? ` — ${detail}` : ""}` }, 502);
          }

          const data = await res.json();
          // Pass through articles + a fetchedAt marker. We never echo the API key.
          return json({
            articles: data.articles ?? [],
            totalArticles: data.totalArticles ?? (data.articles?.length ?? 0),
            fetchedAt: new Date().toISOString(),
          });
        } catch (e: unknown) {
          const msg = safeMessage(e instanceof Error ? e.message : String(e), key);
          return json({ error: "network_error", message: `Could not reach GNews: ${msg}` }, 502);
        }
      },
    },
  },
});
