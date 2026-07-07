import { getEarthquakes } from "@/services/earthquakesApi";
import { normalizeEarthquake } from "../normalizers/earthquakeNormalizer";
import { ProviderCache } from "../cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const TTL_MS = 2 * 60 * 1000;
const cache = new ProviderCache<GlobalEvent[]>(TTL_MS);

export const earthquakeProvider: EventProvider = {
  id: "usgs",
  label: "USGS Earthquakes",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    const cached = cache.get();
    if (!ctx?.force && cached && !cache.isStale()) return cached.data;

    try {
      const quakes = await getEarthquakes("day");
      const events = quakes.map(normalizeEarthquake);
      cache.set(events, true);
      return events;
    } catch (e) {
      const fallback = cached?.data ?? [];
      cache.set(fallback, false, e instanceof Error ? e.message : String(e));
      return fallback;
    }
  },

  getStatus(): ProviderStatusSnapshot {
    return {
      id: "usgs",
      label: "USGS Earthquakes",
      status: cache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get()?.data.length ?? 0,
      error: cache.get()?.error,
    };
  },
};
