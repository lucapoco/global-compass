/**
 * GDACS Provider — Domain Layer
 *
 * Implements the `GeoIntelProvider` contract (fetch/normalize/cache/
 * healthCheck) by calling the server-side proxy at `/api/public/gdacs-proxy`.
 */
import { normalizeGdacsBatch, type GdacsFeature } from "./normalizer";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, probeProxyHealth, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { EventProvider } from "@/domain/services/event-engine/providers/types";

const PROXY_URL = "/api/public/gdacs-proxy";
const TTL_MS = 15 * 60 * 1000;

interface ProxyResponse {
  ok: boolean;
  data?: GdacsFeature[];
  error?: string;
  message?: string;
}

async function fetchGdacsFeatures(): Promise<GdacsFeature[]> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");
  url.searchParams.set("daysBack", "14");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as ProxyResponse;

  if (!body.ok) throw new Error(body.message ?? `GDACS proxy error: ${body.error}`);
  return body.data ?? [];
}

export const gdacsGeoIntelProvider: GeoIntelProvider<GdacsFeature> = {
  id: "gdacs",
  label: "GDACS (Multi-Hazard Disaster Alerts)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<GdacsFeature[]> {
    return fetchGdacsFeatures();
  },

  normalize(raw: GdacsFeature[]): GlobalEvent[] {
    return normalizeGdacsBatch(raw);
  },

  async healthCheck(): Promise<ProviderHealth> {
    return probeProxyHealth(`${PROXY_URL}?daysBack=1`, "GDACS");
  },
};

export const gdacsProvider: EventProvider = toEventProvider(gdacsGeoIntelProvider);
