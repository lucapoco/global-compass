/**
 * News Engine — Public Service Facade
 *
 * Redesigned news architecture: aggregates GNews, GDELT, RSS (BBC, Al
 * Jazeera, Guardian, DW, France 24, Sky News, NHK), and user-saved
 * intelligence through the shared `EventEngine`, merges duplicate stories
 * reported by multiple providers, and ranks the result by relevance —
 * producing a materially richer intelligence feed than a single-provider
 * news list.
 */
import { eventEngine } from "@/domain/services/event-engine";
import type { GlobalEventProvider } from "@/domain/models/GlobalEvent";
import { NEWS_PROVIDERS, type AggregatedNewsItem, type NewsBundle } from "./types";
import { groupDuplicateStories } from "./dedup";
import { rankGroups, computeRelevanceScore } from "./ranking";

let cachedBundle: NewsBundle | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export interface GetAggregatedNewsOptions {
  force?: boolean;
  /** Restrict to a subset of news providers (defaults to all: gnews/gdelt/rss/saved). */
  providerIds?: GlobalEventProvider[];
  limit?: number;
}

/** Aggregates, deduplicates, and ranks news across every registered news provider. */
export async function getAggregatedNews(options: GetAggregatedNewsOptions = {}): Promise<NewsBundle> {
  const { force = false, providerIds = NEWS_PROVIDERS, limit } = options;

  if (!force && cachedBundle && Date.now() - cachedAt < CACHE_TTL_MS) {
    return limit ? { ...cachedBundle, items: cachedBundle.items.slice(0, limit) } : cachedBundle;
  }

  const events = await eventEngine.loadAll({ providerIds, force, correlate: false });
  const groups = rankGroups(groupDuplicateStories(events));

  const items: AggregatedNewsItem[] = groups.map((group) => ({
    event: group.canonical,
    corroboration: new Set(group.members.map((m) => m.provider)).size,
    corroboratingProviders: [...new Set(group.members.map((m) => m.provider))],
    relevanceScore: computeRelevanceScore(group),
  }));

  const sourceCounts: Partial<Record<GlobalEventProvider, number>> = {};
  for (const e of events) sourceCounts[e.provider] = (sourceCounts[e.provider] ?? 0) + 1;

  const bundle: NewsBundle = {
    items,
    totalRawItems: events.length,
    duplicatesMerged: events.length - groups.length,
    sourceCounts,
    generatedAt: new Date().toISOString(),
  };

  cachedBundle = bundle;
  cachedAt = Date.now();

  return limit ? { ...bundle, items: bundle.items.slice(0, limit) } : bundle;
}

/** Invalidates the News Engine's cached bundle, forcing a fresh aggregation on next call. */
export function invalidateNewsCache(): void {
  cachedBundle = null;
  cachedAt = 0;
}

export type { AggregatedNewsItem, NewsBundle } from "./types";
export { NEWS_PROVIDERS } from "./types";
