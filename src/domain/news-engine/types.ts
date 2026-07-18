import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";

/** News-producing providers the News Engine aggregates across. */
export const NEWS_PROVIDERS: GlobalEventProvider[] = ["gnews", "gdelt", "rss", "supabase_intelligence"];

export interface AggregatedNewsItem {
  /** The surviving (highest-reliability / richest) GlobalEvent representing this story. */
  event: GlobalEvent;
  /** How many independent providers reported the same underlying story. */
  corroboration: number;
  /** Provider ids that reported this story (deduped). */
  corroboratingProviders: GlobalEventProvider[];
  /** Final relevance score (0-100) used for ranking — see `ranking.ts`. */
  relevanceScore: number;
}

export interface NewsBundle {
  items: AggregatedNewsItem[];
  totalRawItems: number;
  duplicatesMerged: number;
  sourceCounts: Partial<Record<GlobalEventProvider, number>>;
  generatedAt: string;
}
