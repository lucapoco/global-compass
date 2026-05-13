import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side GNews proxy.
 *
 * The browser cannot reliably reach gnews.io directly from the Lovable
 * preview (ad-blockers, network policies, CORS quirks). This proxy:
 *   - reads the API key from server-side env (never exposed to the client)
 *   - forwards a sanitized set of query params to GNews
 *   - returns normalized JSON with proper CORS headers
 *   - maps upstream 401/403/429/network errors to readable JSON responses
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function readKey(): string | undefined {
  const key =
    process.env.GNEWS_API_KEY ??
    process.env.VITE_GNEWS_API_KEY ??
    (globalThis as any)?.GNEWS_API_KEY;
  return typeof key === "string" ? key.trim() : undefined;
}

function safeMessage(raw: string, key: string | undefined): string {
  return key ? raw.replaceAll(key, "***") : raw;
}

export const Route = createFileRoute("/api/public/gnews-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const key = readKey();
        if (!key) {
          return json({ error: "not_configured", message: "GNews API key is not set on the server." }, 500);
        }

        const url = new URL(request.url);
        const q = url.searchParams;

        const params = new URLSearchParams({
          category: (q.get("category") || "general").slice(0, 32),
          lang: (q.get("lang") || "en").slice(0, 8),
          country: (q.get("country") || "us").slice(0, 8),
          max: String(Math.min(Math.max(Number(q.get("max")) || 10, 1), 25)),
          apikey: key,
        });
        const search = q.get("q");
        if (search) params.set("q", search.slice(0, 200));

        const upstream = `https://gnews.io/api/v4/top-headlines?${params.toString()}`;

        try {
          const res = await fetch(upstream);

          if (res.status === 401) return json({ error: "invalid_key", message: "GNews API key is invalid." }, 401);
          if (res.status === 403) return json({ error: "quota_reached", message: "GNews daily quota reached." }, 403);
          if (res.status === 429) return json({ error: "rate_limited", message: "GNews rate limit reached. Try again shortly." }, 429);

          if (!res.ok) {
            let detail = "";
            try { const j = await res.json(); detail = j?.errors?.[0] ?? j?.message ?? ""; } catch {}
            return json({ error: "upstream_error", status: res.status, message: `GNews ${res.status}${detail ? ` — ${detail}` : ""}` }, 502);
          }

          const data = await res.json();
          // Pass through articles + a fetchedAt marker. We never echo the API key.
          return json({
            articles: data.articles ?? [],
            totalArticles: data.totalArticles ?? (data.articles?.length ?? 0),
            fetchedAt: new Date().toISOString(),
          });
        } catch (e: any) {
          const msg = safeMessage(e?.message ?? String(e), key);
          return json({ error: "network_error", message: `Could not reach GNews: ${msg}` }, 502);
        }
      },
    },
  },
});
