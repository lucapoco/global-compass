import { getAllCountries } from "@/services/countriesApi";
import { normalizeCountry } from "../normalizers/countryNormalizer";
import { ProviderCache } from "../cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

/** REST Countries rarely changes — cache for a full session-length window. */
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_COUNTRIES = 200;
const cache = new ProviderCache<GlobalEvent[]>(TTL_MS);

export const countryProvider: EventProvider = {
  id: "rest_countries",
  label: "REST Countries",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    const cached = cache.get();
    if (!ctx?.force && cached && !cache.isStale()) return cached.data;

    try {
      const countries = await getAllCountries();
      const events = countries
        .filter((c) => c.latlng?.length === 2)
        .slice(0, MAX_COUNTRIES)
        .map(normalizeCountry);
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
      id: "rest_countries",
      label: "REST Countries",
      status: cache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get()?.data.length ?? 0,
      error: cache.get()?.error,
    };
  },
};
