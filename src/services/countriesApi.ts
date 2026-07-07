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
 *      → avoids repeated round-trips within a session
 *   2. Server-side cache inside the proxy (same TTLs)
 *      → avoids hitting restcountries.com on every page load
 *   3. Bundled DEMO_COUNTRIES fallback (50 key countries)
 *      → used only when both proxy layers fail, so the app never breaks
 *
 * Status values (exposed via `getCountriesStatus()`):
 *   "live"   — fresh data from restcountries.com through the proxy
 *   "cached" — data returned by the server cache layer
 *   "local"  — bundled fallback (network/proxy entirely unreachable)
 *   "error"  — all fallbacks failed (should never happen)
 */

import type { Country } from "@/types";
import { DEMO_COUNTRIES, searchDemoCountries } from "@/data/demoCountries";

const PROXY = "/api/public/restcountries-proxy";

const CLIENT_CACHE_TTL_ALL_MS = 12 * 60 * 60 * 1000; // 12 hours
const CLIENT_CACHE_TTL_NAME_MS = 30 * 60 * 1000;      // 30 minutes

// ─── Status type ─────────────────────────────────────────────────────────────
export type CountriesStatus = "live" | "cached" | "local" | "error" | "idle";

// Module-level observable status (read via getCountriesStatus / subscribeCountriesStatus)
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

// ─── Client-side in-memory cache ─────────────────────────────────────────────
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

// ─── Proxy helpers ────────────────────────────────────────────────────────────
interface ProxyResponse {
  countries?: unknown[];
  error?: string;
  message?: string;
  source?: "live" | "cached" | "local";
  fetchedAt?: number;
}

async function callProxy(params: Record<string, string>): Promise<ProxyResponse> {
  const sp = new URLSearchParams(params);
  const res = await fetch(`${PROXY}?${sp.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as ProxyResponse;
    throw new Error(body.message ?? `Proxy error ${res.status}`);
  }
  return res.json() as Promise<ProxyResponse>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all countries.
 *
 * Flow:
 *   1. Client in-memory cache (fresh within 12 h) → return immediately
 *   2. Proxy GET ?endpoint=all → server cache or live upstream
 *   3. Bundled DEMO_COUNTRIES fallback
 */
export async function getAllCountries(): Promise<Country[]> {
  // 1. Client cache
  if (isFresh(clientCacheAll.entry)) {
    setStatus(clientCacheAll.entry.source === "live" ? "live" : "cached");
    return clientCacheAll.entry.data;
  }

  try {
    // 2. Proxy (server cache or live upstream)
    const response = await callProxy({ endpoint: "all" });
    const countries = (response.countries ?? []) as Country[];
    const source = response.source === "live" ? "live" : "cached";

    clientCacheAll.entry = { data: countries, fetchedAt: Date.now(), ttlMs: CLIENT_CACHE_TTL_ALL_MS, source };
    setStatus(source);
    return countries;
  } catch {
    // 3. Bundled fallback (stale client cache takes priority over bundled data)
    if (clientCacheAll.entry) {
      setStatus("cached");
      return clientCacheAll.entry.data;
    }
    setStatus("local");
    return DEMO_COUNTRIES;
  }
}

/**
 * Searches countries by name.
 *
 * Flow:
 *   1. Client in-memory cache for this exact query
 *   2. Proxy GET ?endpoint=name&q=<name>
 *   3. Search inside bundled DEMO_COUNTRIES
 *   4. Empty array (never throws)
 */
export async function searchCountryByName(name: string): Promise<Country[]> {
  const key = name.trim().toLowerCase();
  if (!key) return [];

  // 1. Client cache
  const cached = clientCacheName.get(key);
  if (isFresh(cached)) {
    setStatus(cached.source === "live" ? "live" : "cached");
    return cached.data;
  }

  try {
    // 2. Proxy
    const response = await callProxy({ endpoint: "name", q: name.trim() });
    const countries = (response.countries ?? []) as Country[];
    const source = response.source === "live" ? "live" : "cached";

    clientCacheName.set(key, { data: countries, fetchedAt: Date.now(), ttlMs: CLIENT_CACHE_TTL_NAME_MS, source });
    setStatus(source);
    return countries;
  } catch {
    // 3. Bundled fallback
    const demo = searchDemoCountries(name);
    if (demo.length) {
      clientCacheName.set(key, { data: demo, fetchedAt: Date.now(), ttlMs: CLIENT_CACHE_TTL_NAME_MS, source: "local" });
      setStatus("local");
      return demo;
    }
    setStatus("error");
    return [];
  }
}

/** Clears both client-side caches (useful for forced refresh). */
export function clearCountriesCache() {
  clientCacheAll.entry = null;
  clientCacheName.clear();
  setStatus("idle");
}
