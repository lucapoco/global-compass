/**
 * Stability Index Models
 *
 * The Global Stability Index (GSI) is Global Pulse's original algorithm for
 * measuring the current state of world affairs using only data already
 * collected by the platform's providers.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALGORITHM OVERVIEW — GSI
 * ─────────────────────────────────────────────────────────────────────────
 *
 * GSI = 100 − RiskDeduction
 * RiskDeduction = Σ (factor.normalizedScore × factor.weight × 100)
 *
 * Each factor:
 *   1. Collects raw evidence from current GlobalEvents
 *   2. Normalizes evidence to 0–1 (using a configurable saturation threshold)
 *   3. Multiplies by the factor's weight
 *   4. Contributes to total deduction
 *
 * Total weights sum to 1.00 exactly.
 * GSI is always in [0, 100]. 100 = maximum observed stability.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FACTOR WEIGHTS (v1 — see factors.ts for the live table)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Factor                     Weight   Saturation   Notes
 * ─────────────────────────────────────────────────────────────────────────
 * Critical event density      0.22      10 events  Most impactful single factor
 * Military / conflict         0.18      15 events  ACLED + GNews military
 * Political instability       0.10      20 events  High/critical geopolitics
 * Natural disasters           0.10      10 events  EONET + disaster category
 * Earthquake severity         0.10     M6.0 = max  USGS magnitude signal
 * Economic warnings           0.08      12 events  High/critical economy
 * Cyber threats               0.07       8 events  Cyber category
 * Weather emergencies         0.06      10 events  Weather + climate high/critical
 * Health alerts               0.05       8 events  Health category
 * Data quality penalty        0.04     n/a          (100 − avg_confidence) / 100
 * ─────────────────────────────────────────────────────────────────────────
 * Total                       1.00
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONFIDENCE CALCULATION
 * ─────────────────────────────────────────────────────────────────────────
 *
 * confidence =
 *   (provider_coverage  × 0.40)  — fraction of expected providers responding
 * + (data_freshness      × 0.30)  — fraction of events < 6 hours old
 * + (event_density       × 0.20)  — log-normalized event count (≥30 events = 1.0)
 * + (cross_validation    × 0.10)  — fraction of events confirmed by 2+ providers
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTERPRETATION BANDS
 * ─────────────────────────────────────────────────────────────────────────
 *   90–100  Stable       — Low global activity; no critical signals
 *   75–89   Watchful     — Some elevated activity; monitoring warranted
 *   55–74   Elevated     — Meaningful number of concerning signals
 *   35–54   Tense        — Multiple high-severity situations active
 *   15–34   Critical     — Widespread instability across multiple dimensions
 *    0–14   Emergency    — Extreme global crisis conditions observed
 */
import type { GlobalEventCategory } from "@/domain/models/GlobalEvent";

// ─── Stability tier ──────────────────────────────────────────────────────────

export type StabilityTier =
  | "stable"
  | "watchful"
  | "elevated"
  | "tense"
  | "critical"
  | "emergency";

export const STABILITY_TIER_LABELS: Record<StabilityTier, string> = {
  stable:    "Stable",
  watchful:  "Watchful",
  elevated:  "Elevated",
  tense:     "Tense",
  critical:  "Critical",
  emergency: "Emergency",
};

export const STABILITY_TIER_COLORS: Record<StabilityTier, string> = {
  stable:    "#22c55e",  // green-500
  watchful:  "#84cc16",  // lime-500
  elevated:  "#eab308",  // yellow-500
  tense:     "#f97316",  // orange-500
  critical:  "#ef4444",  // red-500
  emergency: "#991b1b",  // red-800
};

export function stabilityTierFromScore(score: number): StabilityTier {
  if (score >= 90) return "stable";
  if (score >= 75) return "watchful";
  if (score >= 55) return "elevated";
  if (score >= 35) return "tense";
  if (score >= 15) return "critical";
  return "emergency";
}

// ─── Factor contribution ──────────────────────────────────────────────────────

/** One factor's evidence and contribution to the final stability score. */
export interface StabilityFactor {
  /** Machine-readable identifier. */
  id: string;
  /** Human-readable label for UI display. */
  label: string;
  /** A one-sentence description of what this factor measures. */
  description: string;
  /** 0–1 weight in the overall calculation. */
  weight: number;
  /** Raw evidence value (count, score, etc. — before normalization). */
  rawValue: number;
  /** Unit of the raw value ("events", "magnitude", "score"). */
  rawUnit: string;
  /** Normalized evidence value in [0, 1]. */
  normalizedScore: number;
  /** Contribution to total risk deduction: normalizedScore × weight × 100. */
  deduction: number;
  /** IDs of GlobalEvents that contributed evidence to this factor. */
  evidenceEventIds: string[];
  /** Human-readable evidence summary. */
  evidenceSummary: string;
}

// ─── Index models ────────────────────────────────────────────────────────────

export interface ConfidenceBreakdown {
  /** 0–100 overall confidence. */
  score: number;
  providerCoverage: number;     // 0–100
  dataFreshness: number;        // 0–100
  eventDensity: number;         // 0–100
  crossValidation: number;      // 0–100
  activeProviders: string[];
  missingProviders: string[];
  totalEvents: number;
  liveEvents: number;
}

export interface GlobalStabilityIndex {
  /** 0–100. The platform's composite stability signal. */
  score: number;
  tier: StabilityTier;
  tierLabel: string;
  /** Total risk deduction from 100 (= 100 − score). */
  riskDeduction: number;
  /** Individual factor contributions, sorted by deduction descending. */
  factors: StabilityFactor[];
  /** The top 3 factors driving instability. */
  topDrivers: StabilityFactor[];
  confidence: ConfidenceBreakdown;
  /** ISO timestamp of calculation. */
  calculatedAt: string;
  /** ISO timestamp of the oldest event used in calculation. */
  dataFrom: string;
  /** ISO timestamp of the most recent event used. */
  dataTo: string;
  eventCount: number;
}

export interface CountryStabilityIndex {
  countryName: string;
  countryCode?: string;
  score: number;
  tier: StabilityTier;
  tierLabel: string;
  riskDeduction: number;
  factors: StabilityFactor[];
  topDrivers: StabilityFactor[];
  confidence: ConfidenceBreakdown;
  calculatedAt: string;
  eventCount: number;
}

export interface RegionalStabilityEntry {
  region: string;
  countries: string[];
  score: number;
  tier: StabilityTier;
  tierLabel: string;
  eventCount: number;
  confidence: ConfidenceBreakdown;
  topDriverFactors: string[];
}

export interface RegionalStabilityIndex {
  entries: RegionalStabilityEntry[];
  mostStable: RegionalStabilityEntry | null;
  leastStable: RegionalStabilityEntry | null;
  calculatedAt: string;
}

// ─── Change summary ───────────────────────────────────────────────────────────

export type TrendDirection = "up" | "down" | "stable";

export interface StabilityChange {
  previous: number;
  current: number;
  delta: number;
  direction: TrendDirection;
  label: string;  // "+3.2 pts since yesterday"
}

// ─── Category activity ────────────────────────────────────────────────────────

export interface CategoryActivity {
  category: GlobalEventCategory;
  label: string;
  eventCount: number;
  criticalCount: number;
  highCount: number;
  avgRiskScore: number;
  share: number;  // 0–1 fraction of total events
}
