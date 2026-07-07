import { getWeather } from "@/services/weatherApi";
import { normalizeWeather } from "../normalizers/weatherNormalizer";
import { ProviderCache } from "../cache/providerCache";
import type { ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

/**
 * Weather is a per-city lookup, not a bulk feed like the other providers, so it is
 * intentionally excluded from `EventEngine.loadAll()`'s default provider set and
 * exposed as an on-demand loader instead (`loadForCity`). Pages that need a weather
 * GlobalEvent (e.g. Reports, Weather page) can call this directly.
 */
const TTL_MS = 10 * 60 * 1000;
const cacheByCity = new Map<string, ProviderCache<GlobalEvent>>();

function cacheFor(city: string): ProviderCache<GlobalEvent> {
  const key = city.toLowerCase();
  let c = cacheByCity.get(key);
  if (!c) {
    c = new ProviderCache<GlobalEvent>(TTL_MS);
    cacheByCity.set(key, c);
  }
  return c;
}

export const weatherProvider = {
  id: "openweather" as const,
  label: "OpenWeather",
  ttlMs: TTL_MS,

  async loadForCity(city: string, force = false): Promise<GlobalEvent> {
    const cache = cacheFor(city);
    const cached = cache.get();
    if (!force && cached && !cache.isStale()) return cached.data;

    const weather = await getWeather(city);
    const event = normalizeWeather(weather);
    cache.set(event, true);
    return event;
  },

  getStatus(city: string): ProviderStatusSnapshot {
    const cache = cacheFor(city);
    return {
      id: "openweather",
      label: "OpenWeather",
      status: cache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get() ? 1 : 0,
      error: cache.get()?.error,
    };
  },
};
