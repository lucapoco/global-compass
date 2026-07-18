import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side GDELT DOC 2.0 API proxy.
 *
 * GDELT indexes worldwide online news coverage in near-real-time across
 * 65 languages. We use it as a second, independent news signal (alongside
 * GNews and curated RSS feeds) for the redesigned News Engine — mainly to
 * surface breaking coverage and corroborate stories from other providers.
 *
 * Endpoint: https://api.gdeltproject.org/api/v2/doc/doc
 *   ?query=...&mode=artlist&format=json&maxrecords=75&timespan=1d&sort=DateDesc
 *
 * GDELT already sets a wildcard CORS header, but we still proxy server-side
 * for consistent caching/error-handling with every other integration.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ALLOWED_TIMESPANS = new Set(["1h", "3h", "6h", "12h", "1d", "3d", "1w"]);
const DEFAULT_QUERY = "(earthquake OR wildfire OR flood OR conflict OR cyberattack OR outbreak OR crisis)";

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}
const cacheByQuery = new Map<string, CacheEntry>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/gdelt-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("query") ?? DEFAULT_QUERY).slice(0, 300);
        const maxrecords = Math.min(100, Math.max(1, Number(url.searchParams.get("maxrecords") ?? 50)));
        const rawTimespan = url.searchParams.get("timespan") ?? "1d";
        const timespan = ALLOWED_TIMESPANS.has(rawTimespan) ? rawTimespan : "1d";

        const cacheKey = `${query}::${maxrecords}::${timespan}`;
        const cached = cacheByQuery.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, data: cached.data, source: "cached", fetchedAt: cached.fetchedAt });
        }

        const params = new URLSearchParams({
          query,
          mode: "artlist",
          format: "json",
          maxrecords: String(maxrecords),
          timespan,
          sort: "DateDesc",
        });
        const upstream = `${BASE_URL}?${params.toString()}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal, headers: { Accept: "application/json" } });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`GDELT responded ${res.status}`);
          const text = await res.text();
          // GDELT occasionally returns an empty body or a plain-text error message
          // instead of JSON when a query yields no results — guard defensively.
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { articles: [] };
          }
          const articles = Array.isArray((parsed as { articles?: unknown[] })?.articles)
            ? (parsed as { articles: unknown[] }).articles
            : [];

          const entry = { data: articles, fetchedAt: Date.now() };
          cacheByQuery.set(cacheKey, entry);
          return json({ ok: true, data: articles, source: "live", fetchedAt: entry.fetchedAt });
        } catch (e) {
          if (cached) {
            return json({ ok: true, data: cached.data, source: "cached", fetchedAt: cached.fetchedAt });
          }
          const message = e instanceof Error ? e.message : String(e);
          return json({ ok: false, error: "network_error", message }, 502);
        }
      },
    },
  },
});
