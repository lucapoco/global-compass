/**
 * RSS Aggregator Provider — Domain Layer
 *
 * Fans out to every trusted-broadcaster source registered in
 * `/api/public/rss-proxy` (BBC, Al Jazeera, The Guardian, DW, France 24,
 * Sky News, NHK World) in parallel, normalizes each feed, and merges the
 * results into a single `GeoIntelProvider`.
 */
import { normalizeRssBatch } from "./normalizer";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, probeProxyHealth, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext, EventProvider } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { ParsedRssItem } from "@/routes/api/public/rss-proxy";

const PROXY_URL = "/api/public/rss-proxy";
const TTL_MS = 15 * 60 * 1000;

/** Mirrors `RSS_SOURCES` in the proxy route — kept in sync manually since the
 *  route module runs server-side only and cannot be imported by the client bundle. */
const SOURCE_IDS: Array<{ id: string; label: string }> = [
  { id: "bbc", label: "BBC News" },
  { id: "aljazeera", label: "Al Jazeera" },
  { id: "guardian", label: "The Guardian" },
  { id: "dw", label: "DW" },
  { id: "france24", label: "France 24" },
  { id: "skynews", label: "Sky News" },
  { id: "nhk", label: "NHK World" },
];

interface ProxyResponse {
  ok: boolean;
  items?: ParsedRssItem[];
  label?: string;
  error?: string;
  message?: string;
}

interface RawFeed {
  sourceId: string;
  sourceLabel: string;
  items: ParsedRssItem[];
}

async function fetchOneFeed(sourceId: string, label: string): Promise<RawFeed> {
  const url = new URL(PROXY_URL, globalThis.location?.origin ?? "http://localhost:3000");
  url.searchParams.set("source", sourceId);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    const body = (await res.json()) as ProxyResponse;
    if (!body.ok) return { sourceId, sourceLabel: label, items: [] };
    return { sourceId, sourceLabel: label, items: body.items ?? [] };
  } catch (e) {
    console.warn(`[RssProvider] feed "${sourceId}" failed`, e);
    return { sourceId, sourceLabel: label, items: [] };
  }
}

async function fetchAllFeeds(): Promise<RawFeed[]> {
  return Promise.all(SOURCE_IDS.map((s) => fetchOneFeed(s.id, s.label)));
}

export const rssGeoIntelProvider: GeoIntelProvider<RawFeed> = {
  id: "rss",
  label: "Trusted News RSS (BBC, Al Jazeera, Guardian & more)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<RawFeed[]> {
    return fetchAllFeeds();
  },

  normalize(raw: RawFeed[]): GlobalEvent[] {
    return raw.flatMap((feed) => normalizeRssBatch(feed.items, feed.sourceId, feed.sourceLabel));
  },

  async healthCheck(): Promise<ProviderHealth> {
    return probeProxyHealth(`${PROXY_URL}?source=bbc`, "RSS aggregator");
  },
};

export const rssProvider: EventProvider = toEventProvider(rssGeoIntelProvider);
