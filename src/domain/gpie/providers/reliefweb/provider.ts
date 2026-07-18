/**
 * ReliefWeb Provider — Domain Layer
 *
 * Implements the `GeoIntelProvider` contract by calling the server-side
 * proxy at `/api/public/reliefweb-proxy`. Gracefully disabled (empty result,
 * no error surfaced to the user) when `RELIEFWEB_APPNAME` is not configured
 * server-side — identical degradation pattern to the ACLED / NASA FIRMS
 * providers.
 */
import { normalizeReliefWebBatch, type ReliefWebRecord } from "./normalizer";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, probeProxyHealth, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext, EventProvider } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const PROXY_URL = "/api/public/reliefweb-proxy";
const TTL_MS = 30 * 60 * 1000;

interface ProxyResponse {
  ok: boolean;
  data?: ReliefWebRecord[];
  error?: string;
  message?: string;
}

async function fetchReliefWebRecords(): Promise<ReliefWebRecord[]> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");
  url.searchParams.set("limit", "60");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as ProxyResponse;

  if (!body.ok) {
    if (body.error === "not_configured") return []; // intentionally disabled — not an error
    throw new Error(body.message ?? `ReliefWeb proxy error: ${body.error}`);
  }
  return body.data ?? [];
}

export const reliefwebGeoIntelProvider: GeoIntelProvider<ReliefWebRecord> = {
  id: "reliefweb",
  label: "ReliefWeb (Humanitarian Crises)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<ReliefWebRecord[]> {
    return fetchReliefWebRecords();
  },

  normalize(raw: ReliefWebRecord[]): GlobalEvent[] {
    return normalizeReliefWebBatch(raw);
  },

  async healthCheck(): Promise<ProviderHealth> {
    return probeProxyHealth(`${PROXY_URL}?limit=1`, "ReliefWeb");
  },
};

export const reliefwebProvider: EventProvider = toEventProvider(reliefwebGeoIntelProvider);
