import { createFileRoute } from "@tanstack/react-router";
import {
  fetchAllCountries,
  searchCountriesByName,
  type CountriesFetchSource,
} from "@/server/restCountriesService";
import type { Country } from "@/types";

/**
 * Server-side REST Countries proxy.
 *
 * Upstream: REST Countries v5 (api.restcountries.com) when REST_COUNTRIES_API_KEY
 * is set. Legacy v3.1 was deprecated — it no longer returns country data.
 *
 * Without an API key, serves bundled reference data (50 countries) so search,
 * compare, and country pages never break during demos or offline use.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const CACHE_TTL_ALL_MS = 12 * 60 * 60 * 1000;
const CACHE_TTL_NAME_MS = 30 * 60 * 1000;

interface CacheEntry {
  countries: Country[];
  source: CountriesFetchSource;
  fetchedAt: number;
  ttlMs: number;
}

const serverCache = new Map<string, CacheEntry>();
let allCountriesCache: CacheEntry | null = null;

function getCached(key: string): CacheEntry | null {
  const entry = serverCache.get(key) ?? (key === "all" ? allCountriesCache : null);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > entry.ttlMs) {
    if (key === "all") allCountriesCache = null;
    else serverCache.delete(key);
    return null;
  }
  return entry;
}

function setCached(key: string, countries: Country[], source: CountriesFetchSource, ttlMs: number): void {
  const entry: CacheEntry = { countries, source, fetchedAt: Date.now(), ttlMs };
  if (key === "all") allCountriesCache = entry;
  else serverCache.set(key, entry);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/restcountries-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const endpoint = (url.searchParams.get("endpoint") ?? "all").toLowerCase();
        const q = url.searchParams.get("q")?.trim().slice(0, 120);

        if (endpoint === "all") {
          const cached = getCached("all");
          if (cached) {
            return json({
              countries: cached.countries,
              source: cached.source === "live" ? "cached" : cached.source,
              fetchedAt: cached.fetchedAt,
            });
          }

          const result = await fetchAllCountries();
          setCached("all", result.countries, result.source, CACHE_TTL_ALL_MS);
          return json({
            countries: result.countries,
            source: result.source,
            fetchedAt: Date.now(),
          });
        }

        if (endpoint === "name") {
          if (!q) {
            return json({ error: "missing_query", message: "Provide ?q= for name search." }, 400);
          }

          const cacheKey = `name:${q.toLowerCase()}`;
          const cached = getCached(cacheKey);
          if (cached) {
            return json({
              countries: cached.countries,
              source: cached.source === "live" ? "cached" : cached.source,
              fetchedAt: cached.fetchedAt,
            });
          }

          const allCached = getCached("all");
          const result = await searchCountriesByName(q, allCached?.countries);
          setCached(cacheKey, result.countries, result.source, CACHE_TTL_NAME_MS);

          if (!result.countries.length) {
            return json(
              {
                error: "not_found",
                message: `Country "${q}" not found.`,
                countries: [],
                source: "local",
              },
              404,
            );
          }

          return json({
            countries: result.countries,
            source: result.source,
            fetchedAt: Date.now(),
          });
        }

        return json(
          { error: "invalid_endpoint", message: `Unknown endpoint "${endpoint}". Use "all" or "name".` },
          400,
        );
      },
    },
  },
});
