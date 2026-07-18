/**
 * Location Correlation Strategy
 *
 * Detects geographic proximity between two events using:
 *   1. Country name equality (fast, no coordinates required)
 *   2. Continent/region equality (for events missing coordinates)
 *   3. Haversine distance when both events carry coordinates
 *
 * Score breakdown:
 *   Same country      → score 80, weight 0.35
 *   Same region       → score 50, weight 0.20
 *   Distance ≤ 100km  → score 90, weight 0.35
 *   Distance ≤ 300km  → score 65, weight 0.35
 *   Distance ≤ 600km  → score 40, weight 0.25
 */
import { haversineDistanceKm, hasCoordinates } from "@/domain/utils/geo";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { CorrelationStrategy, CorrelationEngineConfig, StrategyResult } from "../types";

// Rough continent groupings by country name (extend as needed)
const REGION_MAP: Record<string, string> = {
  "United States": "North America", "Canada": "North America", "Mexico": "North America",
  "Brazil": "South America", "Argentina": "South America", "Colombia": "South America",
  "United Kingdom": "Europe", "France": "Europe", "Germany": "Europe", "Italy": "Europe",
  "Spain": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Russia": "Europe",
  "China": "Asia", "Japan": "Asia", "India": "Asia", "South Korea": "Asia",
  "Indonesia": "Asia", "Pakistan": "Asia", "Bangladesh": "Asia", "Vietnam": "Asia",
  "Saudi Arabia": "Middle East", "Iran": "Middle East", "Iraq": "Middle East",
  "Turkey": "Middle East", "Israel": "Middle East", "Syria": "Middle East",
  "Nigeria": "Africa", "Ethiopia": "Africa", "South Africa": "Africa",
  "Kenya": "Africa", "Egypt": "Africa", "Congo": "Africa",
  "Australia": "Oceania", "New Zealand": "Oceania",
};

function getRegion(country?: string): string | null {
  if (!country) return null;
  return REGION_MAP[country] ?? null;
}

export const locationStrategy: CorrelationStrategy = {
  name: "location",

  run(a: GlobalEvent, b: GlobalEvent, config: CorrelationEngineConfig): StrategyResult | null {
    // ── Country equality ────────────────────────────────────────────────
    if (
      config.enableCountryMatch &&
      a.country &&
      b.country &&
      a.country.toLowerCase() === b.country.toLowerCase()
    ) {
      return {
        relationship: "same_country",
        score: 80,
        weight: 0.35,
        reason: `Same country (${a.country})`,
      };
    }

    // ── Geographic distance ─────────────────────────────────────────────
    if (hasCoordinates(a.coordinates) && hasCoordinates(b.coordinates)) {
      const distKm = haversineDistanceKm(a.coordinates, b.coordinates);

      if (distKm <= 100) {
        return {
          relationship: "same_region",
          score: 90,
          weight: 0.35,
          reason: `Very close proximity (${Math.round(distKm)} km apart)`,
        };
      }
      if (distKm <= config.maxDistanceKm) {
        const score = Math.round(65 - ((distKm - 100) / (config.maxDistanceKm - 100)) * 25);
        return {
          relationship: "same_region",
          score: Math.max(40, score),
          weight: 0.30,
          reason: `Geographic proximity (${Math.round(distKm)} km apart)`,
        };
      }
    }

    // ── Region/continent equality ───────────────────────────────────────
    const regionA = getRegion(a.country);
    const regionB = getRegion(b.country);
    if (regionA && regionB && regionA === regionB) {
      return {
        relationship: "same_region",
        score: 45,
        weight: 0.18,
        reason: `Same region (${regionA})`,
      };
    }

    return null;
  },
};
