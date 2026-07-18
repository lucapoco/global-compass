/**
 * Source Reliability Scoring
 *
 * Assigns a reliability score (0–100) to every data provider based on
 * institutional authority, data methodology, and verification practices.
 *
 * Score bands:
 *   95–100  Authoritative government / intergovernmental organisations
 *            with strict data collection standards (USGS, NASA, World Bank).
 *   85–94   Specialised academic / institutional research bodies with
 *            documented methodology (ACLED, OpenWeather professional tier).
 *   70–84   Commercial data aggregators and user-curated sources
 *            (GNews, Supabase saved data).
 *   0–69    Unknown, experimental, or synthetic providers.
 *
 * Configuration:
 *   Scores are intentionally stored in a plain lookup object so they can be
 *   overridden at runtime (e.g. for A/B testing or manual recalibration)
 *   without redeploying.  Call `setProviderReliability()` to override.
 */
import type { GlobalEventProvider } from "@/domain/models/GlobalEvent";

/* ── Reliability table ──────────────────────────────────────────────────── */

const DEFAULT_RELIABILITY: Record<GlobalEventProvider, number> = {
  // === Tier 1: Authoritative institutional sources (95–100) ===
  usgs: 98,          // USGS — real-time seismograph network, fully automated
  nasa_eonet: 95,    // NASA — government-operated natural event observatory
  world_bank: 95,    // World Bank — global development indicators, annual audit

  // === Tier 2: High-quality specialised research sources (85–94) ===
  gdacs: 93,         // GDACS — UN/EC-backed multi-hazard disaster coordination system
  acled: 90,         // ACLED — systematic conflict data, academic peer review
  nasa_firms: 90,    // NASA FIRMS — satellite-detected active fire hotspots
  reliefweb: 89,     // ReliefWeb — UN OCHA humanitarian reporting service
  openweather: 85,   // OpenWeather — verified meteorological stations network
  rest_countries:88, // REST Countries — stable reference data (rarely changes)

  // === Tier 3: Aggregators and user-curated sources (70–84) ===
  supabase_alerts: 80,          // User-curated saved alerts (manually verified)
  supabase_intelligence: 78,    // User-curated bookmarked intelligence items
  rss: 76,           // Trusted international broadcaster RSS feeds (BBC, Reuters-tier)
  gnews: 72,         // GNews — aggregates from multiple news sources; quality varies
  gdelt: 68,         // GDELT — massive automated global news index; high volume, lower per-item curation

  // === Internal / synthetic sources ===
  internal: 65,      // Computed / synthetic — no external verification
};

let reliabilityTable = { ...DEFAULT_RELIABILITY };

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Returns the reliability score (0–100) for a provider.
 * Unknown providers receive a conservative default of 60.
 */
export function getProviderReliability(provider: GlobalEventProvider | string): number {
  return (reliabilityTable as Record<string, number>)[provider] ?? 60;
}

/**
 * Override a provider's reliability score at runtime (0–100 clamped).
 * Useful for runtime recalibration without a deploy.
 */
export function setProviderReliability(
  provider: GlobalEventProvider | string,
  score: number,
): void {
  const clamped = Math.round(Math.min(100, Math.max(0, score)));
  (reliabilityTable as Record<string, number>)[provider] = clamped;
}

/** Reset all overrides back to the default calibration table. */
export function resetReliabilityDefaults(): void {
  reliabilityTable = { ...DEFAULT_RELIABILITY };
}

/** Snapshot of the current reliability table (useful for debug panels). */
export function getReliabilitySnapshot(): Record<string, number> {
  return { ...reliabilityTable };
}

/* ── Tier helpers ───────────────────────────────────────────────────────── */

export type ReliabilityTier = "authoritative" | "high" | "standard" | "low";

export function getReliabilityTier(score: number): ReliabilityTier {
  if (score >= 95) return "authoritative";
  if (score >= 85) return "high";
  if (score >= 70) return "standard";
  return "low";
}

export const TIER_LABELS: Record<ReliabilityTier, string> = {
  authoritative: "Authoritative",
  high: "High Reliability",
  standard: "Standard",
  low: "Low / Unverified",
};
