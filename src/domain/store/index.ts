/**
 * Intelligence Store — Public API
 *
 * The single import point for every page's provider-derived data needs.
 * See `intelligenceStore.ts` for the full design rationale.
 */
export {
  invalidateIntelligenceStore,
  getIntelligenceStoreStats,
  getLatestEvents,
  getGlobalIntelligence,
  getTrendingTopics,
  getCountryIntelligence,
  getCountryStabilityIndex,
  getRegionalIntelligence,
  getHighestRiskCountries,
  getHighestRiskEvents,
  getAnalytics,
  getTimeline,
  getIntelligenceGraph,
  getKnowledgeGraph,
  getCountryKnowledgeGraph,
  getDashboardData,
  getGlobalStabilityIndex,
  getIntelligenceSummary,
  getChanges,
  getEmergingRisks,
  getProviderStatus,
  getRelatedEvents,
  type GetLatestEventsOptions,
  type GetGlobalIntelligenceOptions,
  type GetTrendingTopicsOptions,
} from "./intelligenceStore";

export type { DashboardIntelligenceData, RegionalIntelligenceProfile, TrendingTopic } from "./types";

// Re-export the underlying event model + filter contract so pages that need
// them (filters, categories, severities) don't have to reach into the
// domain/services layer directly.
export type {
  GlobalEvent,
  GlobalEventCategory,
  GlobalEventProvider,
  GlobalEventSeverity,
  GlobalEventStatus,
} from "@/domain/models/GlobalEvent";
export type { EventFilterOptions } from "@/domain/services/event-engine/filters/eventFilters";

// Re-export the GPIE profile types most pages need to type their state with.
export type { GlobalIntelligenceSnapshot, CountryIntelligenceProfile } from "@/domain/gpie/models/CountryIntelligence";
