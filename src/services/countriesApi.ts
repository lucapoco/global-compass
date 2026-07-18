/**
 * Countries service — the ONLY place the frontend reads country data.
 *
 * Request flow (every path):
 *   Browser → /api/public/restcountries-proxy (same-origin, no CORS issues)
 *             └─ server fetch → restcountries.com (server-side, no CORS issues)
 *
 * The browser NEVER calls restcountries.com directly.
 *
 * Cache hierarchy (three levels):
 *   1. Client in-memory cache (12 h for "all", 30 min for name searches)
 *   2. Server-side cache inside the proxy (same TTLs)
 *   3. Bundled FALLBACK_COUNTRIES fallback (50 key countries)
 *
 * Status values (exposed via `getCountriesStatus()`):
 *   "live"   — fresh data from restcountries.com through the proxy
 *   "cached" — data returned by the server or client cache layer
 *   "local"  — bundled fallback (network/proxy entirely unreachable)
 *   "error"  — all fallbacks failed for a name search (returns empty array)
 */

import type { Country } from "@/types";
import { FALLBACK_COUNTRIES, searchFallbackCountries } from "@/data/fallbackCountries";

const PROXY = "/api/public/restcountries-proxy";

const CLIENT_CACHE_TTL_ALL_MS = 12 * 60 * 60 * 1000;
const CLIENT_CACHE_TTL_NAME_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [400, 900] as const;

/** Common aliases → REST Countries search term */
const SEARCH_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  america: "United States",
  uk: "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  korea: "South Korea",
  drc: "Democratic Republic of the Congo",
  russia: "Russia",
};

export type CountriesStatus = "live" | "cached" | "local" | "error" | "idle";

let _status: CountriesStatus = "idle";
const _listeners = new Set<(s: CountriesStatus) => void>();

function setStatus(s: CountriesStatus) {
  _status = s;
  for (const fn of _listeners) fn(s);
}

export function getCountriesStatus(): CountriesStatus {
  return _status;
}

export function subscribeCountriesStatus(listener: (s: CountriesStatus) => void): () => void {
  _listeners.add(listener);
  listener(_status);
  return () => _listeners.delete(listener);
}

interface ClientCacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
  source: "live" | "cached" | "local";
}

const clientCacheAll: { entry: ClientCacheEntry<Country[]> | null } = { entry: null };
const clientCacheName = new Map<string, ClientCacheEntry<Country[]>>();

function isFresh<T>(entry: ClientCacheEntry<T> | null | undefined, now = Date.now()): entry is ClientCacheEntry<T> {
  return !!entry && now - entry.fetchedAt < entry.ttlMs;
}

/** Normalize user input (aliases, trim) before upstream search. */
export function normalizeCountryQuery(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const alias = SEARCH_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

interface ProxyResponse {
  countries?: unknown[];
  error?: string;
  message?: string;
  source?: "live" | "cached" | "local";
  fetchedAt?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callProxyOnce(params: Record<string, string>): Promise<ProxyResponse> {
  const sp = new URLSearchParams(params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROXY}?${sp.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as ProxyResponse;
    // 404 with empty list — caller will use local fallback
    if (!res.ok) {
      if (res.status === 404 && Array.isArray(body.countries)) {
        return { ...body, countries: body.countries };
      }
      throw new Error(body.message ?? `Proxy error ${res.status}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function resolveFromLocal(name: string): Country[] {
  const local = searchLocalCountries(name);
  if (local.length) return local;
  // Warm all-countries cache from demo if needed, then search again
  if (!clientCacheAll.entry) {
    clientCacheAll.entry = {
      data: FALLBACK_COUNTRIES,
      fetchedAt: Date.now(),
      ttlMs: CLIENT_CACHE_TTL_ALL_MS,
      source: "local",
    };
  }
  return searchLocalCountries(name);
}

async function callProxyWithRetry(params: Record<string, string>): Promise<ProxyResponse> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 900);
    try {
      return await callProxyOnce(params);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt >= MAX_RETRIES) break;
    }
  }
  throw lastError ?? new Error("REST Countries proxy unavailable");
}

function searchLocalCountries(name: string): Country[] {
  const normalized = normalizeCountryQuery(name);
  const demo = searchFallbackCountries(normalized);
  if (demo.length) return demo;

  const q = normalized.toLowerCase();
  const fromAll = clientCacheAll.entry?.data.filter(
    (c) =>
      c.name.common.toLowerCase().includes(q) ||
      c.name.official.toLowerCase().includes(q) ||
      c.cca2?.toLowerCase() === q ||
      c.cca3?.toLowerCase() === q,
  );
  return fromAll?.length ? fromAll : [];
}

/**
 * Returns all countries.
 * Never throws — degrades to demo data on total failure.
 */
export async function getAllCountries(): Promise<Country[]> {
  if (isFresh(clientCacheAll.entry)) {
    setStatus(clientCacheAll.entry.source === "live" ? "live" : "cached");
    return clientCacheAll.entry.data;
  }

  try {
    const response = await callProxyWithRetry({ endpoint: "all" });
    const countries = (response.countries ?? []) as Country[];
    if (countries.length === 0) throw new Error("Empty country list");
    const source = response.source === "live" ? "live" : "cached";
    clientCacheAll.entry = { data: countries, fetchedAt: Date.now(), ttlMs: CLIENT_CACHE_TTL_ALL_MS, source };
    setStatus(source);
    return countries;
  } catch {
    if (clientCacheAll.entry) {
      setStatus("cached");
      return clientCacheAll.entry.data;
    }
    setStatus("local");
    return FALLBACK_COUNTRIES;
  }
}

/**
 * Searches countries by name, code, or alias.
 * Never throws — returns [] only when nothing matches anywhere.
 */
export async function searchCountryByName(name: string): Promise<Country[]> {
  const normalized = normalizeCountryQuery(name);
  const key = normalized.toLowerCase();
  if (!key) return [];

  const cached = clientCacheName.get(key);
  if (isFresh(cached)) {
    setStatus(cached.source === "live" ? "live" : cached.source === "local" ? "local" : "cached");
    return cached.data;
  }

  try {
    const response = await callProxyWithRetry({ endpoint: "name", q: normalized });
    let countries = (response.countries ?? []) as Country[];

    if (countries.length === 0) {
      countries = resolveFromLocal(normalized);
      if (countries.length) {
        clientCacheName.set(key, {
          data: countries,
          fetchedAt: Date.now(),
          ttlMs: CLIENT_CACHE_TTL_NAME_MS,
          source: "local",
        });
        setStatus("local");
        return countries;
      }
      setStatus("error");
      return [];
    }

    const source = response.source === "live" ? "live" : response.source === "local" ? "local" : "cached";
    clientCacheName.set(key, { data: countries, fetchedAt: Date.now(), ttlMs: CLIENT_CACHE_TTL_NAME_MS, source });
    setStatus(source);
    return countries;
  } catch {
    const stale = clientCacheName.get(key);
    if (stale) {
      setStatus("cached");
      return stale.data;
    }

    const local = resolveFromLocal(normalized);
    if (local.length) {
      clientCacheName.set(key, {
        data: local,
        fetchedAt: Date.now(),
        ttlMs: CLIENT_CACHE_TTL_NAME_MS,
        source: "local",
      });
      setStatus("local");
      return local;
    }

    setStatus("error");
    return [];
  }
}

/** Resolve a single country — convenience wrapper for pages. */
export async function resolveCountry(name: string): Promise<Country | null> {
  const results = await searchCountryByName(name);
  return results[0] ?? null;
}

/** Resolve by ISO alpha-2/alpha-3 code using cached all-countries or demo data. */
export async function resolveCountryByCode(code: string): Promise<Country | null> {
  const q = code.trim().toUpperCase();
  if (!q) return null;

  const demo = FALLBACK_COUNTRIES.find((c) => c.cca2 === q || c.cca3 === q);
  if (demo) return demo;

  try {
    const all = await getAllCountries();
    return all.find((c) => c.cca2?.toUpperCase() === q || c.cca3?.toUpperCase() === q) ?? null;
  } catch {
    return demo ?? null;
  }
}

export function clearCountriesCache() {
  clientCacheAll.entry = null;
  clientCacheName.clear();
  setStatus("idle");
}
