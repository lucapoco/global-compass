/**
 * Report, Recommendation, and Analytics Models
 *
 * Types for executive reports, data-driven recommendations,
 * comparative analysis, and the analytics dashboard.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { StabilityTier } from "./StabilityIndex";

// ─── Recommendation ───────────────────────────────────────────────────────────

export type RecommendationPriority = "immediate" | "high" | "monitor" | "informational";
export type RecommendationCategory =
  | "security_alert"
  | "emerging_risk"
  | "stability_change"
  | "economic_signal"
  | "natural_hazard"
  | "diplomatic_development"
  | "general";

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  /** Evidence events that justify this recommendation. */
  evidenceEventIds: string[];
  evidenceSummary: string;
  /** Countries mentioned in the evidence. */
  affectedCountries: string[];
  confidence: number;
  generatedAt: string;
}

// ─── Emerging risk ───────────────────────────────────────────────────────────

export interface EmergingRisk {
  id: string;
  title: string;
  region: string;
  countries: string[];
  category: GlobalEventCategory;
  severity: GlobalEventSeverity;
  /** 0–100 confidence that this is a genuine emerging situation. */
  confidence: number;
  /** Number of new events detected. */
  newEventCount: number;
  /** Risk score delta from baseline. */
  riskDelta: number;
  reason: string;
  explanation: string;
  supportingEvents: GlobalEvent[];
  detectedAt: string;
}

// ─── Change detection ─────────────────────────────────────────────────────────

export type ChangeWindowId = "24h" | "today" | "7d";

export interface PlatformChangeSummary {
  windowId: ChangeWindowId;
  windowLabel: string;
  newEvents: GlobalEvent[];
  newEventCount: number;
  riskDelta: number;  // positive = risk increased
  stabilityDelta: number;  // positive = more stable
  mostActiveRegions: Array<{ region: string; eventCount: number }>;
  topNewCategories: Array<{ category: GlobalEventCategory; count: number }>;
  emergingCountries: string[];  // countries with most new events
  calculatedAt: string;
}

// ─── Comparative analysis ─────────────────────────────────────────────────────

export interface CountryComparisonMetric {
  label: string;
  valueA: number | string | null;
  valueB: number | string | null;
  winner: "a" | "b" | "tie" | "unknown";
  explanation: string;
}

export interface CountryComparison {
  countryA: string;
  countryB: string;
  metrics: CountryComparisonMetric[];
  stabilityScoreA: number;
  stabilityScoreB: number;
  eventCountA: number;
  eventCountB: number;
  conclusion: string;
  generatedAt: string;
}

// ─── Executive report ─────────────────────────────────────────────────────────

export type ReportType =
  | "global"
  | "country"
  | "regional"
  | "daily_briefing"
  | "weekly_briefing"
  | "emergency";

export interface ReportSection {
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

export interface ExecutiveReport {
  id: string;
  type: ReportType;
  title: string;
  subtitle: string;
  subject: string;   // country name, region name, or "Global"
  classification: string;   // e.g. "UNCLASSIFIED // FOR EDUCATIONAL USE"
  generatedAt: string;
  dataFrom: string;
  dataTo: string;

  executiveSummary: string;
  keyFindings: string[];
  sections: ReportSection[];

  stabilityScore: number | null;
  stabilityTier: StabilityTier | null;
  topEvents: GlobalEvent[];
  recommendations: Recommendation[];

  sourceProviders: string[];
  eventCount: number;
  confidence: number;

  metadata: Record<string, unknown>;
}

// ─── Analytics summary ────────────────────────────────────────────────────────

export interface TopRiskCountry {
  rank: number;
  country: string;
  riskScore: number;
  eventCount: number;
  criticalCount: number;
  trend: "up" | "down" | "stable";
  topCategory: GlobalEventCategory;
}

export interface ProviderDistributionEntry {
  provider: string;
  label: string;
  eventCount: number;
  share: number;  // 0–1
  avgConfidence: number;
  avgRiskScore: number;
  liveCount: number;
}

export interface AnalyticsSummary {
  topRiskCountries: TopRiskCountry[];
  categoryBreakdown: Array<{
    category: GlobalEventCategory;
    label: string;
    count: number;
    share: number;
    avgRisk: number;
  }>;
  providerDistribution: ProviderDistributionEntry[];
  dailyActivity: Array<{
    dateLabel: string;
    dateMs: number;
    eventCount: number;
    criticalCount: number;
    avgRisk: number;
  }>;
  totalEvents: number;
  criticalEvents: number;
  liveEvents: number;
  avgGlobalRisk: number;
  calculatedAt: string;
}
