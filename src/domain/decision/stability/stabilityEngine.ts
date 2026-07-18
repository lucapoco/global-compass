/**
 * Stability Engine
 *
 * Computes Global, Country, and Regional Stability Indices using the
 * factor system defined in factors.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────
 *   const gsi = computeGlobalStabilityIndex(events);
 *   const csi = computeCountryStabilityIndex(events, "France");
 *   const rsi = computeRegionalStabilityIndex(events);
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONFIDENCE MODEL
 * ─────────────────────────────────────────────────────────────────────────
 * confidence = 0.40 × providerCoverage
 *            + 0.30 × dataFreshness
 *            + 0.20 × eventDensity
 *            + 0.10 × crossValidation
 *
 * providerCoverage: fraction of registered providers that contributed events
 * dataFreshness:    fraction of events < 6 hours old
 * eventDensity:     log-normalized event count (30 events → 1.0)
 * crossValidation:  fraction of events confirmed by 2+ providers
 */
import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import { extractFactors } from "./factors";
import {
  stabilityTierFromScore,
  STABILITY_TIER_LABELS,
  type GlobalStabilityIndex,
  type CountryStabilityIndex,
  type RegionalStabilityIndex,
  type RegionalStabilityEntry,
  type ConfidenceBreakdown,
} from "../models/StabilityIndex";

// ─── Region → countries mapping ───────────────────────────────────────────────

export const REGION_COUNTRIES: Record<string, string[]> = {
  "Europe": [
    "France", "Germany", "United Kingdom", "Italy", "Spain", "Poland",
    "Ukraine", "Russia", "Netherlands", "Belgium", "Sweden", "Norway",
    "Switzerland", "Austria", "Romania", "Greece", "Portugal", "Czechia",
    "Hungary", "Serbia", "Croatia", "Bulgaria", "Slovakia", "Denmark",
    "Finland", "Ireland", "Moldova", "Belarus", "Albania", "Kosovo",
  ],
  "North America": [
    "United States", "Canada", "Mexico", "Cuba", "Jamaica",
    "Guatemala", "Honduras", "El Salvador", "Nicaragua", "Costa Rica",
    "Panama", "Dominican Republic", "Haiti",
  ],
  "South America": [
    "Brazil", "Argentina", "Colombia", "Venezuela", "Chile", "Peru",
    "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guyana", "Suriname",
  ],
  "Asia": [
    "China", "Japan", "India", "South Korea", "Indonesia", "Pakistan",
    "Bangladesh", "Vietnam", "Thailand", "Myanmar", "Philippines",
    "Malaysia", "North Korea", "Afghanistan", "Nepal", "Sri Lanka",
    "Cambodia", "Laos", "Singapore", "Taiwan", "Mongolia",
  ],
  "Middle East": [
    "Saudi Arabia", "Iran", "Iraq", "Syria", "Turkey", "Israel",
    "Palestine", "Lebanon", "Jordan", "Yemen", "Qatar", "United Arab Emirates",
    "Kuwait", "Oman", "Bahrain", "Libya", "Egypt",
  ],
  "Africa": [
    "Nigeria", "Ethiopia", "Egypt", "South Africa", "Kenya", "Tanzania",
    "Uganda", "Ghana", "Mozambique", "Madagascar", "Somalia", "Sudan",
    "Algeria", "Morocco", "Tunisia", "Senegal", "Mali", "Niger",
    "Burkina Faso", "Cameroon", "Congo", "Democratic Republic of the Congo",
    "Zimbabwe", "Zambia", "Angola", "Rwanda", "Burundi",
  ],
  "Oceania": [
    "Australia", "New Zealand", "Papua New Guinea", "Fiji",
    "Solomon Islands", "Vanuatu", "Samoa",
  ],
};

// ─── Known providers (for coverage calculation) ───────────────────────────────

const EXPECTED_PROVIDERS: Set<GlobalEventProvider> = new Set([
  "usgs", "nasa_eonet", "gnews", "openweather", "acled",
]);

// ─── Confidence computation ───────────────────────────────────────────────────

const SIX_HOURS_MS = 6 * 3_600_000;
const LOG_DENSITY_MAX = 30; // 30 events → density = 1.0

function computeConfidence(events: GlobalEvent[]): ConfidenceBreakdown {
  if (!events.length) {
    return {
      score: 10,
      providerCoverage: 0, dataFreshness: 0, eventDensity: 0, crossValidation: 0,
      activeProviders: [], missingProviders: [...EXPECTED_PROVIDERS], totalEvents: 0, liveEvents: 0,
    };
  }

  const activeProviders = [...new Set(events.map((e) => e.provider))];
  const missingProviders = [...EXPECTED_PROVIDERS].filter(
    (p) => !activeProviders.includes(p),
  );
  const providerCoverage = activeProviders.filter((p) =>
    EXPECTED_PROVIDERS.has(p as GlobalEventProvider),
  ).length / EXPECTED_PROVIDERS.size;

  const now = Date.now();
  const freshEvents = events.filter(
    (e) => now - new Date(e.timestamp).getTime() <= SIX_HOURS_MS,
  );
  const dataFreshness = freshEvents.length / events.length;

  const eventDensity = Math.min(1, Math.log(events.length + 1) / Math.log(LOG_DENSITY_MAX + 1));

  // Cross-validation: events where ≥2 providers have related events
  // Approximate via events that have relatedEvents with different providers
  const crossValidated = events.filter((e) => e.relatedEvents.length > 0).length;
  const crossValidation = crossValidated / events.length;

  const raw =
    providerCoverage * 0.40 +
    dataFreshness * 0.30 +
    eventDensity * 0.20 +
    crossValidation * 0.10;

  return {
    score: Math.round(raw * 100),
    providerCoverage: Math.round(providerCoverage * 100),
    dataFreshness: Math.round(dataFreshness * 100),
    eventDensity: Math.round(eventDensity * 100),
    crossValidation: Math.round(crossValidation * 100),
    activeProviders: activeProviders as string[],
    missingProviders: missingProviders as string[],
    totalEvents: events.length,
    liveEvents: events.filter((e) => e.live).length,
  };
}

// ─── Core index computation ───────────────────────────────────────────────────

function computeIndex(events: GlobalEvent[]): {
  score: number;
  factors: ReturnType<typeof extractFactors>;
  confidence: ConfidenceBreakdown;
  dataFrom: string;
  dataTo: string;
} {
  const factors = extractFactors(events);
  const totalDeduction = factors.reduce((s, f) => s + f.deduction, 0);
  const score = Math.round(Math.max(0, Math.min(100, 100 - totalDeduction)));
  const confidence = computeConfidence(events);

  const timestamps = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
  const dataFrom = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString();
  const dataTo = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();

  return { score, factors, confidence, dataFrom, dataTo };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeGlobalStabilityIndex(events: GlobalEvent[]): GlobalStabilityIndex {
  const { score, factors, confidence, dataFrom, dataTo } = computeIndex(events);
  const tier = stabilityTierFromScore(score);

  return {
    score,
    tier,
    tierLabel: STABILITY_TIER_LABELS[tier],
    riskDeduction: Math.round(100 - score),
    factors,
    topDrivers: factors.slice(0, 3),
    confidence,
    calculatedAt: new Date().toISOString(),
    dataFrom,
    dataTo,
    eventCount: events.length,
  };
}

export function computeCountryStabilityIndex(
  events: GlobalEvent[],
  countryName: string,
): CountryStabilityIndex {
  const countryEvents = events.filter((e) => {
    if (!e.country) return false;
    const target = countryName.toLowerCase();
    const src = e.country.toLowerCase();
    return src === target || src.includes(target) || target.includes(src);
  });

  const { score, factors, confidence } = computeIndex(countryEvents);
  const tier = stabilityTierFromScore(score);

  return {
    countryName,
    score,
    tier,
    tierLabel: STABILITY_TIER_LABELS[tier],
    riskDeduction: Math.round(100 - score),
    factors,
    topDrivers: factors.slice(0, 3),
    confidence,
    calculatedAt: new Date().toISOString(),
    eventCount: countryEvents.length,
  };
}

export function computeRegionalStabilityIndex(events: GlobalEvent[]): RegionalStabilityIndex {
  const entries: RegionalStabilityEntry[] = [];

  for (const [region, countries] of Object.entries(REGION_COUNTRIES)) {
    const regionEvents = events.filter(
      (e) => e.country && countries.some(
        (c) => c.toLowerCase() === e.country!.toLowerCase(),
      ),
    );

    const { score, factors, confidence } = computeIndex(regionEvents);
    const tier = stabilityTierFromScore(score);

    entries.push({
      region,
      countries,
      score,
      tier,
      tierLabel: STABILITY_TIER_LABELS[tier],
      eventCount: regionEvents.length,
      confidence,
      topDriverFactors: factors.slice(0, 2).map((f) => f.label),
    });
  }

  entries.sort((a, b) => a.score - b.score); // least stable first

  return {
    entries,
    mostStable: entries[entries.length - 1] ?? null,
    leastStable: entries[0] ?? null,
    calculatedAt: new Date().toISOString(),
  };
}
