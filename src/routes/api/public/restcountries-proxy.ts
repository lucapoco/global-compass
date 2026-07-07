import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side REST Countries proxy.
 *
 * Request flow:
 *   Browser → /api/public/restcountries-proxy → restcountries.com (server-side)
 *
 * Why a proxy instead of direct browser fetch?
 *   • restcountries.com sets restrictive CORS headers on some deployments / CDN nodes.
 *   • Cloudflare Workers + Lovable preview environments block browser requests to
 *     external origins that lack proper CORS (ad-blockers, network policies).
 *   • Routing through a server-side fetch sidesteps all CORS entirely.
 *
 * Endpoints:
 *   GET ?endpoint=all               → all countries (lightweight fields for map/stats)
 *   GET ?endpoint=name&q=Romania    → single-country search (all detail fields)
 *
 * Features:
 *   • Server-side in-memory cache (12 h for "all", 30 min for "name" searches).
 *   • Up to 2 retries with 600 ms delay on network/5xx failures.
 *   • 8-second fetch timeout so the server never hangs a request.
 *   • If the upstream is unavailable but we have cached data, the cache is served.
 *   • Response includes a `source` field ("live" | "cached" | "error") so the
 *     frontend can update API Health accurately.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const BASE_URL = "https://restcountries.com/v3.1";

// Lightweight fields for the "all countries" endpoint (map capitals, stats, compare list)
const ALL_FIELDS = "name,cca2,cca3,capital,region,subregion,population,area,flags,latlng,languages,currencies,timezones,borders,maps";

// Full fields for single-country search
const NAME_FIELDS = "name,cca2,cca3,capital,region,subregion,population,area,languages,currencies,timezones,borders,flags,maps,latlng";

const DEV = typeof process !== "undefined" && process.env.NODE_ENV === "development";
const log = (...args: unknown[]) => { if (DEV) console.log("[restcountries-proxy]", ...args); };

// ─── Server-side in-memory cache ────────────────────────────────────────────
const CACHE_TTL_ALL_MS = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_TTL_NAME_MS = 30 * 60 * 1000;      // 30 minutes

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
  ttlMs: number;
}

const serverCache = new Map<string, CacheEntry>();

function getCached(key: string): CacheEntry | null {
  const entry = serverCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > entry.ttlMs) {
    serverCache.delete(key);
    return null;
  }
  return entry;
}

function setCached(key: string, data: unknown, ttlMs: number): void {
  serverCache.set(key, { data, fetchedAt: Date.now(), ttlMs });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, retries = 2, delayMs = 600): Promise<{ data: unknown; ok: boolean; status: number }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
      log(`retry ${attempt}/${retries} →`, url);
    }
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        return { data, ok: true, status: res.status };
      }
      // 404 = valid "not found", no retry needed
      if (res.status === 404) return { data: [], ok: true, status: 404 };
      // 5xx → retry
      if (res.status >= 500 && attempt < retries) continue;
      return { data: null, ok: false, status: res.status };
    } catch (e) {
      if (attempt < retries) continue;
      throw e;
    }
  }
  return { data: null, ok: false, status: 0 };
}

// ─── Route ───────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/public/restcountries-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const endpoint = (url.searchParams.get("endpoint") ?? "all").toLowerCase();
        const q = url.searchParams.get("q")?.trim().slice(0, 120);

        // ── "all countries" ─────────────────────────────────────────────────
        if (endpoint === "all") {
          const cacheKey = "all";
          const cached = getCached(cacheKey);

          if (cached) {
            log("serving all countries from server cache");
            return json({ countries: cached.data, source: "cached", fetchedAt: cached.fetchedAt });
          }

          const upstream = `${BASE_URL}/all?fields=${ALL_FIELDS}`;
          log("fetching all countries →", upstream);

          try {
            const { data, ok } = await fetchWithRetry(upstream);
            if (ok && Array.isArray(data) && data.length > 0) {
              setCached(cacheKey, data, CACHE_TTL_ALL_MS);
              log(`fetched ${(data as unknown[]).length} countries, cached for 12h`);
              return json({ countries: data, source: "live", fetchedAt: Date.now() });
            }
            // Upstream returned something unexpected — serve stale cache if any
            const stale = serverCache.get(cacheKey);
            if (stale) {
              return json({ countries: stale.data, source: "cached", fetchedAt: stale.fetchedAt });
            }
            return json({ error: "upstream_error", message: "REST Countries returned an unexpected response." }, 502);
          } catch (e) {
            const stale = serverCache.get(cacheKey);
            if (stale) {
              log("upstream error, serving stale cache");
              return json({ countries: stale.data, source: "cached", fetchedAt: stale.fetchedAt });
            }
            const msg = e instanceof Error ? e.message : String(e);
            log("upstream error (no cache):", msg);
            return json({ error: "network_error", message: `Could not reach REST Countries: ${msg}` }, 502);
          }
        }

        // ── "name search" ────────────────────────────────────────────────────
        if (endpoint === "name") {
          if (!q) return json({ error: "missing_query", message: "Provide ?q= for name search." }, 400);

          const cacheKey = `name:${q.toLowerCase()}`;
          const cached = getCached(cacheKey);

          if (cached) {
            log("name search cache hit:", q);
            return json({ countries: cached.data, source: "cached", fetchedAt: cached.fetchedAt });
          }

          const upstream = `${BASE_URL}/name/${encodeURIComponent(q)}?fields=${NAME_FIELDS}`;
          log("name search →", upstream);

          try {
            const { data, ok, status } = await fetchWithRetry(upstream);
            if (ok) {
              const list = Array.isArray(data) ? data : [];
              setCached(cacheKey, list, CACHE_TTL_NAME_MS);
              return json({ countries: list, source: "live", fetchedAt: Date.now() });
            }
            return json({ error: "not_found", message: `Country "${q}" not found (${status}).` }, 404);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return json({ error: "network_error", message: `Could not reach REST Countries: ${msg}` }, 502);
          }
        }

        return json({ error: "invalid_endpoint", message: `Unknown endpoint "${endpoint}". Use "all" or "name".` }, 400);
      },
    },
  },
});
