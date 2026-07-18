/**
 * Global Pulse Intelligence Engine (GPIE) — Public API
 *
 * This barrel is the single import point for all higher-level intelligence
 * operations.  Import from here, not from nested sub-modules.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AGGREGATION
 * ─────────────────────────────────────────────────────────────────────────
 *   getGlobalIntelligence()       — full platform snapshot (all providers)
 *   getGlobalIntelligenceSummary()— lightweight KPI totals only
 *   getCountryIntelligence()      — country profile (events + World Bank)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DATA PROVIDERS
 * ─────────────────────────────────────────────────────────────────────────
 *   getWorldBankData()            — macroeconomic indicators per country
 *   clearWorldBankCache()         — force-invalidate World Bank cache
 *   getWorldBankCacheStatus()     — cache age / staleness for a country
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SCORING
 * ─────────────────────────────────────────────────────────────────────────
 *   getProviderReliability()      — numeric reliability score for a provider
 *   setProviderReliability()      — runtime override for a provider's score
 *   getReliabilityTier()          — tier label from a numeric score
 *   getReliabilitySnapshot()      — full reliability table snapshot
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MODELS
 * ─────────────────────────────────────────────────────────────────────────
 *   CountryIntelligenceProfile    — country page data contract
 *   GlobalIntelligenceSnapshot    — dashboard data contract
 *   WorldBankIndicators           — World Bank indicator data contract
 *   WorldBankSummary              — compressed World Bank display data
 *   RiskTier                      — "critical" | "high" | "medium" | "low"
 *   ReliabilityTier               — "authoritative" | "high" | "standard" | "low"
 */

// Aggregation
export {
  getGlobalIntelligence,
  getGlobalIntelligenceSummary,
  type GetGlobalIntelligenceOptions,
} from "./aggregation/getGlobalIntelligence";

export {
  getCountryIntelligence,
  type GetCountryIntelligenceOptions,
} from "./aggregation/getCountryIntelligence";

// World Bank data provider
export {
  getWorldBankData,
  clearWorldBankCache,
  getWorldBankCacheStatus,
} from "./providers/worldBankProvider";

// ACLED service (higher-level methods on top of the EventProvider)
export { acledService, acledEventProvider } from "./providers/acled/provider";
export { getAcledCacheStatus, clearAcledCache, type AcledCacheMode } from "./providers/acled/cache";
export { mapAcledEvent, type AcledMappedClassification } from "./providers/acled/mapper";
export { normalizeAcledRecord, normalizeAcledBatch } from "./providers/acled/normalizer";

// Scoring
export {
  getProviderReliability,
  setProviderReliability,
  resetReliabilityDefaults,
  getReliabilitySnapshot,
  getReliabilityTier,
  TIER_LABELS,
  type ReliabilityTier,
} from "./scoring/sourceReliability";

// Models
export type {
  CountryIntelligenceProfile,
  CountryEventCounts,
  CountryRiskAssessment,
  GlobalIntelligenceSnapshot,
  RiskTier,
} from "./models/CountryIntelligence";

export type {
  WorldBankIndicators,
  WorldBankSummary,
  WbIndicatorKey,
} from "./models/WorldBankData";

export {
  WB_INDICATORS,
  formatGDP,
  formatPopulation,
  summariseWorldBankData,
} from "./models/WorldBankData";
