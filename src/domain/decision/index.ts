/**
 * Decision Support Engine — Public API
 *
 * This is the ONLY file the UI or other domain layers should import from.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUICK REFERENCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Stability:
 *   getGlobalStabilityIndex()           → GlobalStabilityIndex
 *   getCountryStabilityIndex(name)      → CountryStabilityIndex
 *   getRegionalStabilityIndex()         → RegionalStabilityIndex
 *
 * Explainability:
 *   explainGlobalStability()            → ScoreExplanation
 *   explainCountryStability(name)       → ScoreExplanation
 *   explainEventRisk(events, label?)    → ScoreExplanation  (sync)
 *
 * Analytics:
 *   getAnalyticsSummary()               → AnalyticsSummary
 *
 * Change Detection:
 *   getChanges(windowId?)               → PlatformChangeSummary
 *
 * Emerging Risks:
 *   getEmergingRisks()                  → EmergingRisk[]
 *
 * Comparison:
 *   getCountryComparison(a, b)          → CountryComparison
 *
 * Intelligence Summaries:
 *   getIntelligenceSummary(type, subject?) → IntelligenceSummary
 *
 * Reports:
 *   generateReport(type, subject?)      → ExecutiveReport
 *
 * Cache:
 *   invalidateDecisionCache()           → void
 *   getDecisionCacheStats()             → { entries: number }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STABILITY INDEX INTERPRETATION
 * ─────────────────────────────────────────────────────────────────────────
 *   90–100  Stable
 *   75–89   Watchful
 *   55–74   Elevated
 *   35–54   Tense
 *   15–34   Critical
 *    0–14   Emergency
 */

// ─── Service facade (async, cached) ──────────────────────────────────────────
export {
  getGlobalStabilityIndex,
  getCountryStabilityIndex,
  getRegionalStabilityIndex,
  explainGlobalStability,
  explainCountryStability,
  explainEventRisk,
  getAnalyticsSummary,
  getChanges,
  getEmergingRisks,
  getCountryComparison,
  getIntelligenceSummary,
  generateReport,
  invalidateDecisionCache,
  getDecisionCacheStats,
} from "./services/decisionEngine";

// ─── Pure computation (sync, no caching — for custom integrations) ────────────
export { computeGlobalStabilityIndex, computeCountryStabilityIndex, computeRegionalStabilityIndex, REGION_COUNTRIES } from "./stability/stabilityEngine";
export { extractFactors } from "./stability/factors";
export { explainGSI, explainCSI, explainRiskScore } from "./explainability/scoreExplainer";
export { buildAnalyticsSummary, computeTopRiskCountries, computeCategoryBreakdown, computeProviderDistribution, computeDailyActivity, CATEGORY_LABELS } from "./analytics/analyticsService";
export { detectChanges } from "./changeDetection/changeDetector";
export { detectEmergingRisks } from "./emerging/emergingRisks";
export { compareCountries } from "./comparison/countryComparator";
export {
  buildGlobalSummary,
  buildCountrySummary,
  buildRegionalSummary,
  buildDailyBriefing,
  buildWeeklyBriefing,
  buildExecutiveSummary,
  buildEmergencyBriefing,
} from "./summary/summaryEngine";
export {
  generateGlobalReport,
  generateCountryReport,
  generateRegionalReport,
  generateDailyBriefing,
  generateEmergencyBriefing,
} from "./reports/reportGenerator";

// ─── Types ────────────────────────────────────────────────────────────────────

// Stability models
export type {
  GlobalStabilityIndex,
  CountryStabilityIndex,
  RegionalStabilityIndex,
  RegionalStabilityEntry,
  StabilityFactor,
  StabilityTier,
  ConfidenceBreakdown,
  StabilityChange,
  TrendDirection,
  CategoryActivity,
} from "./models/StabilityIndex";
export { stabilityTierFromScore, STABILITY_TIER_LABELS, STABILITY_TIER_COLORS } from "./models/StabilityIndex";

// Report / recommendation models
export type {
  ExecutiveReport,
  Recommendation,
  EmergingRisk,
  PlatformChangeSummary,
  ChangeWindowId,
  CountryComparison,
  CountryComparisonMetric,
  AnalyticsSummary,
  TopRiskCountry,
  ProviderDistributionEntry,
  ReportType,
} from "./models/ReportModel";

// Explainability
export type { ScoreExplanation, ScoreBullet } from "./explainability/scoreExplainer";

// Summary
export type { IntelligenceSummary, SummaryType } from "./summary/summaryEngine";
