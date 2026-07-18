/**
 * ACLED Browser-Side Response Cache
 *
 * Stores normalised `GlobalEvent[]` results from the server proxy, keyed
 * by the query signature (mode + country/region + daysBack).
 *
 * Why browser-side caching on top of the server proxy?
 *   The server proxy already prevents redundant ACLED API calls. This layer
 *   prevents redundant calls to the server proxy itself — e.g. navigating
 *   between pages or mounting the EventEngine multiple times in the same
 *   session will hit this cache, not the server.
 *
 * Cache policy:
 *   latest   events → 30 min (ACLED updates daily; 30 min is sufficient)
 *   country  events → 60 min (country data changes slowly intra-day)
 *   region   events → 45 min
 *   conflict events → 20 min (armed conflict is the most time-sensitive)
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AcledCacheMode = "latest" | "country" | "region" | "conflict";

const TTL: Record<AcledCacheMode, number> = {
  latest:   30 * 60 * 1000,
  country:  60 * 60 * 1000,
  region:   45 * 60 * 1000,
  conflict: 20 * 60 * 1000,
};

interface CacheEntry {
  events: GlobalEvent[];
  fetchedAt: number;
  mode: AcledCacheMode;
  key: string;
}

// ─── Cache store ──────────────────────────────────────────────────────────────

const store = new Map<string, CacheEntry>();

function buildKey(mode: AcledCacheMode, qualifier?: string): string {
  return qualifier ? `${mode}:${qualifier.toLowerCase().trim()}` : mode;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCachedAcledEvents(
  mode: AcledCacheMode,
  qualifier?: string,
): GlobalEvent[] | null {
  const key = buildKey(mode, qualifier);
  const entry = store.get(key);
  if (!entry) return null;

  const ttl = TTL[mode];
  if (Date.now() - entry.fetchedAt > ttl) {
    store.delete(key);
    return null;
  }

  return entry.events;
}

export function setCachedAcledEvents(
  mode: AcledCacheMode,
  events: GlobalEvent[],
  qualifier?: string,
): void {
  const key = buildKey(mode, qualifier);
  store.set(key, { events, fetchedAt: Date.now(), mode, key });
}

export function clearAcledCache(mode?: AcledCacheMode, qualifier?: string): void {
  if (mode) {
    const key = buildKey(mode, qualifier);
    store.delete(key);
  } else {
    store.clear();
  }
}

export interface AcledCacheStatus {
  entries: number;
  keys: string[];
  totalEvents: number;
}

export function getAcledCacheStatus(): AcledCacheStatus {
  let totalEvents = 0;
  const keys: string[] = [];
  for (const [key, entry] of store) {
    keys.push(key);
    totalEvents += entry.events.length;
  }
  return { entries: store.size, keys, totalEvents };
}
