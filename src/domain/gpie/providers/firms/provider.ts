/**
 * NASA FIRMS Provider — Domain Layer
 *
 * Implements the `GeoIntelProvider` contract by calling the server-side
 * proxy at `/api/firms/fires`. Gracefully disabled (empty result, no error
 * surfaced to the user) when `FIRMS_MAP_KEY` is not configured server-side —
 * identical degradation pattern to the ACLED provider.
 */
import { normalizeFirmsBatch, type FirmsRow } from "./normalizer";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, probeProxyHealth, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext, EventProvider } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const PROXY_URL = "/api/firms/fires";
const TTL_MS = 20 * 60 * 1000;

interface ProxyResponse {
  ok: boolean;
  data?: FirmsRow[];
  error?: string;
  message?: string;
}

async function fetchFirmsRows(): Promise<FirmsRow[]> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");
  url.searchParams.set("days", "1");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const body = (await res.json()) as ProxyResponse;

  if (!body.ok) {
    if (body.error === "not_configured") return []; // intentionally disabled — not an error
    throw new Error(body.message ?? `FIRMS proxy error: ${body.error}`);
  }
  return body.data ?? [];
}

export const firmsGeoIntelProvider: GeoIntelProvider<FirmsRow> = {
  id: "nasa_firms",
  label: "NASA FIRMS (Active Fire Detection)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<FirmsRow[]> {
    return fetchFirmsRows();
  },

  normalize(raw: FirmsRow[]): GlobalEvent[] {
    return normalizeFirmsBatch(raw);
  },

  async healthCheck(): Promise<ProviderHealth> {
    return probeProxyHealth(`${PROXY_URL}?days=1`, "NASA FIRMS");
  },
};

export const firmsProvider: EventProvider = toEventProvider(firmsGeoIntelProvider);
