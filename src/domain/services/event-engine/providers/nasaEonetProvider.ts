/**
 * NASA EONET Provider
 *
 * Fetches currently-active natural events from NASA's Earth Observatory
 * Natural Event Tracker (EONET) v3 API.
 *
 * CORS: the EONET endpoint returns Access-Control-Allow-Origin: *
 * so direct browser requests work without a server-side proxy.
 *
 * Authentication: none required — the public EONET endpoint is open.
 * Optional server-side `NASA_EONET_API_KEY` may be added via a future proxy
 * for improved rate limits; never expose keys via VITE_* client env vars.
 *
 * TTL: 30 minutes — natural events change slowly but a 30-minute window
 * keeps the data fresh enough for an intelligence platform.
 */
import { ProviderCache } from "../cache/providerCache";
import { normalizeEonetEvent, type EonetRawEvent } from "../normalizers/nasaEonetNormalizer";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const TTL_MS = 30 * 60 * 1000;
const cache = new ProviderCache<GlobalEvent[]>(TTL_MS);

const BASE_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";

interface EonetApiResponse {
  title: string;
  description: string;
  link: string;
  events: EonetRawEvent[];
}

export const nasaEonetProvider: EventProvider = {
  id: "nasa_eonet",
  label: "NASA EONET (Natural Events)",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    const cached = cache.get();
    if (!ctx?.force && cached && !cache.isStale()) return cached.data;

    try {
      const url = new URL(BASE_URL);
      url.searchParams.set("status", "open");
      url.searchParams.set("limit", "100");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`NASA EONET HTTP ${res.status}`);

      const data = (await res.json()) as EonetApiResponse;
      const events = (data.events ?? []).map(normalizeEonetEvent);

      cache.set(events, true);
      return events;
    } catch (e) {
      const fallback = cached?.data ?? [];
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[nasaEonetProvider] failed:", message);
      cache.set(fallback, false, message);
      return fallback;
    }
  },

  getStatus(): ProviderStatusSnapshot {
    return {
      id: "nasa_eonet",
      label: "NASA EONET (Natural Events)",
      status: cache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get()?.data.length ?? 0,
      error: cache.get()?.error,
    };
  },
};
