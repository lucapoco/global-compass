/**
 * GDELT Provider — Domain Layer
 *
 * Implements the `GeoIntelProvider` contract by calling the server-side
 * proxy at `/api/public/gdelt-proxy`. Primarily feeds the News Engine
 * (see `src/domain/news-engine/`) as a second independent news signal.
 */
import { normalizeGdeltBatch, type GdeltArticle } from "./normalizer";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, probeProxyHealth, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext, EventProvider } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const PROXY_URL = "/api/public/gdelt-proxy";
const TTL_MS = 10 * 60 * 1000;

interface ProxyResponse {
  ok: boolean;
  data?: GdeltArticle[];
  error?: string;
  message?: string;
}

export async function fetchGdeltArticles(query?: string, maxrecords = 50, timespan = "1d"): Promise<GdeltArticle[]> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("maxrecords", String(maxrecords));
  url.searchParams.set("timespan", timespan);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as ProxyResponse;

  if (!body.ok) throw new Error(body.message ?? `GDELT proxy error: ${body.error}`);
  return body.data ?? [];
}

export const gdeltGeoIntelProvider: GeoIntelProvider<GdeltArticle> = {
  id: "gdelt",
  label: "GDELT (Global News Index)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<GdeltArticle[]> {
    return fetchGdeltArticles();
  },

  normalize(raw: GdeltArticle[]): GlobalEvent[] {
    return normalizeGdeltBatch(raw);
  },

  async healthCheck(): Promise<ProviderHealth> {
    return probeProxyHealth(`${PROXY_URL}?maxrecords=1`, "GDELT");
  },
};

export const gdeltProvider: EventProvider = toEventProvider(gdeltGeoIntelProvider);
