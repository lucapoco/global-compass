import { fetchIntelligence } from "@/services/newsApi";
import { normalizeIntelligenceItem } from "../normalizers/intelligenceNormalizer";
import { ProviderCache } from "../cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { NewsStatus } from "@/services/newsApi";

const TTL_MS = 5 * 60 * 1000;
const cache = new ProviderCache<GlobalEvent[]>(TTL_MS);

function toEventStatus(status: NewsStatus): GlobalEvent["status"] {
  if (status === "live") return "live";
  if (status === "cached" || status === "rate_limited") return "cached";
  if (status === "demo") return "demo";
  return "error";
}

export const gnewsProvider: EventProvider = {
  id: "gnews",
  label: "GNews (Intelligence Feed)",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    const cached = cache.get();
    if (!ctx?.force && cached && !cache.isStale()) return cached.data;

    try {
      const result = await fetchIntelligence({ limit: 40, force: ctx?.force });
      const status = toEventStatus(result.status);
      const events = result.items.map((item) => normalizeIntelligenceItem(item, status));
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
      id: "gnews",
      label: "GNews (Intelligence Feed)",
      status: cache.getStatus(),
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get()?.data.length ?? 0,
      error: cache.get()?.error,
    };
  },
};
