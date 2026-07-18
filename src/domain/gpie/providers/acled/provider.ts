/**
 * ACLED Provider — Domain Layer
 *
 * Implements the `EventProvider` contract for the EventEngine by calling
 * the server-side proxy at `/api/acled/events`.
 *
 * Credentials NEVER touch this file. Authentication is handled exclusively
 * by `src/server/acled/auth.ts` → `src/routes/api/acled/events.ts`.
 *
 * This class also exposes the higher-level methods that other GPIE services
 * can call:
 *
 *   getLatestEvents()            — all recent events globally
 *   getCountryEvents(country)    — events for a specific country
 *   getRegionEvents(region)      — events for an ACLED region
 *   getConflictEvents()          — armed conflict events only
 *
 * Each method has its own cache key and TTL (see cache.ts).
 */
import { normalizeAcledBatch } from "./normalizer";
import {
  getCachedAcledEvents,
  setCachedAcledEvents,
  clearAcledCache,
  type AcledCacheMode,
} from "./cache";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

// ─── Proxy endpoint ───────────────────────────────────────────────────────────

const PROXY_URL = "/api/acled/events";

// ─── Response shapes ──────────────────────────────────────────────────────────

interface ProxySuccess {
  ok: true;
  data: unknown[];
  count: number;
  fetchedAt: string;
}

interface ProxyError {
  ok: false;
  error: string;
  message: string;
  retryAfterSec?: number;
}

type ProxyResponse = ProxySuccess | ProxyError;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function callProxy(
  params: Record<string, string | number | undefined>,
): Promise<GlobalEvent[]> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });

  const body = (await res.json()) as ProxyResponse;

  if (!body.ok) {
    const err = body as ProxyError;
    if (err.error === "not_configured") {
      // Provider intentionally disabled — return empty, do not log as error
      return [];
    }
    if (err.error === "rate_limited") {
      console.warn(`[AcledProvider] rate limited — retry in ${err.retryAfterSec}s`);
      return [];
    }
    throw new Error(`ACLED proxy error (${err.error}): ${err.message}`);
  }

  return normalizeAcledBatch((body as ProxySuccess).data as never[]);
}

// ─── EventProvider implementation ────────────────────────────────────────────

const TTL_MS = 30 * 60 * 1000;
const bulkCache = new ProviderCache<GlobalEvent[]>(TTL_MS);

export const acledEventProvider: EventProvider = {
  id: "acled",
  label: "ACLED (Conflict & Violence)",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    const browserCached = getCachedAcledEvents("latest");
    if (!ctx?.force && browserCached) return browserCached;

    const providerCached = bulkCache.get();
    if (!ctx?.force && providerCached && !bulkCache.isStale()) return providerCached.data;

    try {
      const events = await callProxy({ mode: "latest", daysBack: 7, limit: 200 });
      setCachedAcledEvents("latest", events);
      bulkCache.set(events, true);
      return events;
    } catch (e) {
      const fallback = providerCached?.data ?? browserCached ?? [];
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[AcledProvider] load failed:", message);
      bulkCache.set(fallback, false, message);
      return fallback;
    }
  },

  getStatus(): ProviderStatusSnapshot {
    return {
      id: "acled",
      label: "ACLED (Conflict & Violence)",
      status: bulkCache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: bulkCache.lastRefreshAt(),
      itemCount: bulkCache.get()?.data.length ?? 0,
      error: bulkCache.get()?.error,
    };
  },
};

// ─── Higher-level GPIE service methods ───────────────────────────────────────

export class AcledProviderService {
  /**
   * Fetch the most recent events globally.
   * @param daysBack  Number of calendar days to look back (default 7)
   * @param limit     Maximum records (default 200)
   */
  async getLatestEvents(daysBack = 7, limit = 200): Promise<GlobalEvent[]> {
    const cached = getCachedAcledEvents("latest");
    if (cached) return cached;

    try {
      const events = await callProxy({ mode: "latest", daysBack, limit });
      setCachedAcledEvents("latest", events);
      return events;
    } catch (e) {
      console.warn("[AcledProviderService.getLatestEvents]", e);
      return [];
    }
  }

  /**
   * Fetch events for a specific country.
   * @param country  Country name as used by ACLED (e.g. "Syria", "Ethiopia")
   * @param daysBack Number of calendar days to look back (default 30)
   */
  async getCountryEvents(country: string, daysBack = 30): Promise<GlobalEvent[]> {
    const cached = getCachedAcledEvents("country", country);
    if (cached) return cached;

    try {
      const events = await callProxy({ mode: "country", country, daysBack, limit: 100 });
      setCachedAcledEvents("country", events, country);
      return events;
    } catch (e) {
      console.warn("[AcledProviderService.getCountryEvents]", country, e);
      return [];
    }
  }

  /**
   * Fetch events for an ACLED region.
   * @param region  ACLED region name (e.g. "Western Africa", "South Asia")
   * @param daysBack Number of calendar days to look back (default 14)
   */
  async getRegionEvents(region: string, daysBack = 14): Promise<GlobalEvent[]> {
    const cached = getCachedAcledEvents("region", region);
    if (cached) return cached;

    try {
      const events = await callProxy({ mode: "region", region, daysBack, limit: 150 });
      setCachedAcledEvents("region", events, region);
      return events;
    } catch (e) {
      console.warn("[AcledProviderService.getRegionEvents]", region, e);
      return [];
    }
  }

  /**
   * Fetch armed conflict events only (battles, explosions, violence).
   * @param daysBack Number of calendar days to look back (default 7)
   */
  async getConflictEvents(daysBack = 7): Promise<GlobalEvent[]> {
    const cached = getCachedAcledEvents("conflict");
    if (cached) return cached;

    try {
      const events = await callProxy({ mode: "conflict", daysBack, limit: 150 });
      setCachedAcledEvents("conflict", events);
      return events;
    } catch (e) {
      console.warn("[AcledProviderService.getConflictEvents]", e);
      return [];
    }
  }

  /** Flush all cached ACLED events (forces a fresh proxy call on next access). */
  invalidateCache(mode?: AcledCacheMode): void {
    clearAcledCache(mode);
  }
}

/** Shared singleton for use across GPIE services. */
export const acledService = new AcledProviderService();
