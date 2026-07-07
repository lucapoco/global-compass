/**
 * Intelligence Engine — Domain Types
 *
 * These types power the new processing layer that sits between raw GNews/API data
 * and the UI. Nothing here breaks the existing IntelligenceItem / newsApi contract.
 */

import type { IntelligenceSeverity } from "@/types";

// ─── Categories ───────────────────────────────────────────────────────────────
/** Full extended category set (superset of the legacy IntelligenceCategory). */
export type ExtendedCategory =
  | "geopolitics"
  | "military"
  | "economy"
  | "finance"
  | "technology"
  | "energy"
  | "cybersecurity"
  | "climate"
  | "weather"
  | "earthquake"
  | "disaster"
  | "health"
  | "transportation"
  | "infrastructure"
  | "migration"
  | "crime"
  | "science"
  | "diplomacy"
  | "space"
  | "environment"
  | "general"
  | "unknown";

export type EventSeverity = IntelligenceSeverity; // "low" | "medium" | "high" | "critical"

// ─── Entity extraction ────────────────────────────────────────────────────────
/** All entity groups extracted from event text. */
export interface EntityGroup {
  countries: string[];
  cities: string[];
  leaders: string[];
  organizations: string[];
  companies: string[];
  alliances: string[];
  conflicts: string[];
  infrastructure: string[];
  technologies: string[];
  commodities: string[];
  disasters: string[];
}

// ─── Cluster ──────────────────────────────────────────────────────────────────
/** One article that was merged into this Intelligence Event. */
export interface ClusterSource {
  url: string;
  title: string;
  source: string;
  publishedAt: string;
}

// ─── Intelligence Event ───────────────────────────────────────────────────────
/**
 * The canonical processed event produced by IntelligenceEngine.
 * Every raw GNews article is normalized into this shape before reaching the UI.
 */
export interface IntelligenceEvent {
  /** Stable unique ID (derived from primary article URL or title hash). */
  id: string;
  title: string;
  /** One-paragraph summary suitable for display. */
  summary: string;
  /** Primary detected country. */
  country?: string;
  /** Broad world region. */
  region?: string;
  /** Approximate event coordinates for map integration. */
  coordinates?: { lat: number; lng: number };
  /** Dominant/primary category. */
  category: ExtendedCategory;
  /** All matching categories (multi-category support). */
  categories: ExtendedCategory[];
  severity: EventSeverity;
  /** 0–100 composite importance. Higher = more newsworthy / urgent. */
  importance: number;
  /** 0–100 estimated classification confidence. */
  confidence: number;
  publishedAt: string;
  source: string;
  url?: string;
  imageUrl?: string;
  /** Significant keywords extracted from the text. */
  keywords: string[];
  /** Named entities detected in the text. */
  entities: EntityGroup;
  /** IDs of correlated IntelligenceEvents. */
  relatedEventIds: string[];
  /** Additional articles merged into this cluster. */
  clusterSources: ClusterSource[];
  /** Total article count (1 = not clustered). */
  articleCount: number;
  /** Optional AI-generated summary (populated on demand). */
  aiSummary?: string;
  isLive: boolean;
  isDemo?: boolean;
}

// ─── Country Risk ─────────────────────────────────────────────────────────────
export interface CountryRiskV2 {
  country: string;
  score: number;
  /** Recent trend vs. previous compute. */
  trend: "up" | "stable" | "down";
  label: "Low" | "Medium" | "High" | "Critical";
  activeEvents: number;
  criticalAlerts: number;
  topRisks: string[];
  confidence: number;
  lastUpdated: string;
}

// ─── Global Risk Index ────────────────────────────────────────────────────────
export type GlobalRiskStatus = "stable" | "elevated" | "high" | "critical";

export interface GlobalRiskIndex {
  /** 0–100 composite world risk score. */
  score: number;
  status: GlobalRiskStatus;
  trend: "up" | "stable" | "down";
  components: {
    military: number;
    economic: number;
    climate: number;
    cyber: number;
    health: number;
    geological: number;
  };
  topThreats: string[];
  computedAt: string;
}

// ─── Filter ───────────────────────────────────────────────────────────────────
export type TimeRange = "1h" | "6h" | "24h" | "48h" | "7d" | "all";
export type SortMode = "newest" | "importance" | "severity" | "country" | "source";

export interface IntelligenceFilter {
  query: string;
  categories: ExtendedCategory[];
  severities: EventSeverity[];
  countries: string[];
  sources: string[];
  minImportance: number;
  liveOnly: boolean;
  timeRange: TimeRange;
}

export const DEFAULT_FILTER: IntelligenceFilter = {
  query: "",
  categories: [],
  severities: [],
  countries: [],
  sources: [],
  minImportance: 0,
  liveOnly: false,
  timeRange: "all",
};

// ─── Engine output ────────────────────────────────────────────────────────────
export interface ProcessedIntelligence {
  events: IntelligenceEvent[];
  countryRisks: CountryRiskV2[];
  globalRisk: GlobalRiskIndex;
  processedAt: string;
  /** Number of cluster merges performed. */
  totalClustered: number;
  /** Total source articles before clustering. */
  totalArticles: number;
}
