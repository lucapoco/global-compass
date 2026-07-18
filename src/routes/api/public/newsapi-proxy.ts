import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side NewsAPI.org proxy.
 *
 * `newsApi.ts` previously called `newsapi.org` directly from the BROWSER
 * using `VITE_NEWS_API_KEY` as a secondary fallback provider behind GNews —
 * since Vite inlines every `VITE_*` variable into the client bundle, that
 * key was plainly visible to anyone opening devtools (security audit
 * finding, same class of issue as the OpenWeather key).
 *
 * This proxy keeps the key server-only (`NEWSAPI_API_KEY`, with a
 * `VITE_NEWS_API_KEY` fallback so any existing `.env` keeps working) and
 * forwards only a bounded `pageSize`. If no key is configured it returns
 * `not_configured` and the client silently skips this fallback provider
 * (identical pattern to the ReliefWeb / NASA FIRMS / OpenWeather proxies).
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
  const key = process.env.NEWSAPI_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

function safeMessage(raw: string, key: string | undefined): string {
  return key ? raw.replaceAll(key, "***") : raw;
}

export const Route = createFileRoute("/api/public/newsapi-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const key = readKey();
        if (!key) return json({ error: "not_configured", message: "NewsAPI key not set." }, 503);

        const url = new URL(request.url);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

        const params = new URLSearchParams({
          language: "en",
          pageSize: String(pageSize),
          category: "general",
          apiKey: key,
        });
        const upstream = `https://newsapi.org/v2/top-headlines?${params.toString()}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal });
          clearTimeout(timer);

          if (res.status === 401) return json({ error: "invalid_key", message: "NewsAPI key is invalid." }, 401);
          if (res.status === 429) return json({ error: "rate_limited", message: "NewsAPI rate limit reached." }, 429);
          if (!res.ok) return json({ error: "upstream_error", message: `NewsAPI ${res.status}` }, 502);

          const data = await res.json();
          return json({ articles: data.articles ?? [], fetchedAt: new Date().toISOString() });
        } catch (e) {
          const message = safeMessage(e instanceof Error ? e.message : String(e), key);
          return json({ error: "network_error", message: `Could not reach NewsAPI: ${message}` }, 502);
        }
      },
    },
  },
});
