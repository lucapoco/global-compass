/**
 * Country Intelligence Profile
 *
 * The unified data contract returned by `getCountryIntelligence()`.
 * Every component that renders a country page should consume this
 * interface rather than calling individual services directly.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { WorldBankIndicators } from "./WorldBankData";

/* ── Event statistics ───────────────────────────────────────────────────── */

export interface CountryEventCounts {
  total: number;
  bySeverity: Record<GlobalEventSeverity, number>;
  byCategory: Partial<Record<GlobalEventCategory, number>>;
}

/* ── Risk assessment ────────────────────────────────────────────────────── */

export type RiskTier = "critical" | "high" | "medium" | "low" | "unknown";

export interface CountryRiskAssessment {
  /** Composite risk score 0–100. */
  score: number;
  /** Human-readable tier label. */
  tier: RiskTier;
  /** The top-3 driving factors behind the score. */
  drivers: string[];
}

/* ── Main profile ───────────────────────────────────────────────────────── */

export interface CountryIntelligenceProfile {
  /** Country display name as provided to the query. */
  countryName: string;
  /** ISO-3166 alpha-2 country code (optional, used for World Bank fetch). */
  countryCode: string | undefined;

  /** All normalised events attributed to this country, sorted by recency. */
  events: GlobalEvent[];
  /** Aggregate event statistics. */
  eventCounts: CountryEventCounts;

  /** Macroeconomic indicators from the World Bank (null if unavailable). */
  worldBankData: WorldBankIndicators | null;

  /** Composite intelligence risk assessment. */
  risk: CountryRiskAssessment;

  /** ISO-8601 timestamp when this profile was assembled. */
  lastUpdated: string;
}

/* ── Global intelligence snapshot ──────────────────────────────────────── */

export interface GlobalIntelligenceSnapshot {
  /** All events from all active providers, sorted by recency. */
  events: GlobalEvent[];

  /** Quick statistics for the dashboard header. */
  totals: {
    total: number;
    critical: number;
    high: number;
    live: number;
  };

  /** Events grouped by category (each sub-array sorted by riskScore desc). */
  byCategory: Partial<Record<GlobalEventCategory, GlobalEvent[]>>;

  /** Top 5 highest-risk countries derived from event distribution. */
  topRiskCountries: Array<{ country: string; score: number; eventCount: number }>;

  /** Status snapshot for each registered provider (for health panels). */
  providerStatus: Array<{
    id: string;
    label: string;
    status: string;
    itemCount: number;
    lastRefreshAt: number | null;
    error?: string;
  }>;

  /** ISO-8601 timestamp of snapshot assembly. */
  lastUpdated: string;
}
