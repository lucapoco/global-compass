/**
 * Intelligence Store — Composite Types
 *
 * Types for the aggregation shapes the store introduces on top of the
 * existing GPIE / Decision Support / Knowledge Graph / Correlation Engine
 * models (which are re-exported as-is — see `intelligenceStore.ts`).
 */
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type {
  GlobalStabilityIndex,
  AnalyticsSummary,
  TopRiskCountry,
  EmergingRisk,
  IntelligenceSummary,
  RegionalStabilityEntry,
} from "@/domain/decision";
import type { ProviderStatusSnapshot } from "@/domain/services/event-engine/providers/types";

/** A topic/keyword trending across recent events, ranked by frequency + risk. */
export interface TrendingTopic {
  topic: string;
  count: number;
  avgRisk: number;
  categories: GlobalEventCategory[];
  sampleEventIds: string[];
}

/** Everything the dashboard needs, assembled from ONE shared event load. */
export interface DashboardIntelligenceData {
  events: GlobalEvent[];
  totals: { total: number; critical: number; high: number; live: number };
  gsi: GlobalStabilityIndex;
  summary: IntelligenceSummary;
  analytics: AnalyticsSummary;
  criticalEvents: GlobalEvent[];
  recentEvents: GlobalEvent[];
  topRiskCountries: TopRiskCountry[];
  emergingRisks: EmergingRisk[];
  providerStatus: ProviderStatusSnapshot[];
  lastUpdated: string;
}

/** A region's stability entry plus the events and top-risk countries behind it. */
export interface RegionalIntelligenceProfile {
  region: string;
  stability: RegionalStabilityEntry | null;
  events: GlobalEvent[];
  topRiskCountries: TopRiskCountry[];
  lastUpdated: string;
}
