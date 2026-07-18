/**
 * Global Stability Index — Factor Definitions
 *
 * Each factor extracts evidence from the current GlobalEvent pool,
 * normalizes it, and contributes a deduction from the stability score.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NORMALIZATION FORMULA
 * ─────────────────────────────────────────────────────────────────────────
 *   normalizedScore = min(rawValue / saturationThreshold, 1.0)
 *
 * When rawValue ≥ saturationThreshold, the factor fully contributes its
 * maximum deduction.  This prevents a single outlier from collapsing the
 * score to zero while still rewarding severe situations.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WEIGHT TABLE (all weights sum to exactly 1.00)
 * ─────────────────────────────────────────────────────────────────────────
 *   critical_density    0.22   Dominant factor: critical-severity events
 *   military_activity   0.18   Armed conflict, battles, violence
 *   political_instab    0.10   Geopolitics: high/critical severity
 *   natural_disasters   0.10   EONET + GNews disaster category
 *   earthquake_severity 0.10   USGS magnitude signal
 *   economic_warnings   0.08   Economy high/critical events
 *   cyber_threats       0.07   Cyber category events
 *   weather_emergencies 0.06   Weather + climate high/critical
 *   health_alerts       0.05   Health category events
 *   data_quality        0.04   Penalty for low-confidence data
 * ─────────────────────────────────────────────────────────────────────────
 *
 * To tune the algorithm, adjust weights and saturation thresholds.
 * The code enforces that weights sum to 1.00 (±0.001 floating point).
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { StabilityFactor } from "../models/StabilityIndex";

// ─── Factor spec ──────────────────────────────────────────────────────────────

interface FactorSpec {
  id: string;
  label: string;
  description: string;
  weight: number;
  saturationThreshold: number;
  rawUnit: string;
  extract(events: GlobalEvent[]): { raw: number; eventIds: string[]; summary: string };
}

// ─── Helper utilities ─────────────────────────────────────────────────────────

function matchCat(event: GlobalEvent, cats: string[]): boolean {
  return cats.includes(event.category);
}

function matchSev(event: GlobalEvent, sevs: string[]): boolean {
  return sevs.includes(event.severity);
}

function topIds(events: GlobalEvent[], n = 5): string[] {
  return events
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, n)
    .map((e) => e.id);
}

// ─── Factor definitions ───────────────────────────────────────────────────────

const FACTOR_SPECS: FactorSpec[] = [
  // ── 1. Critical event density (weight 0.22) ─────────────────────────────
  {
    id: "critical_density",
    label: "Critical Event Density",
    description: "Number of events with critical-severity status — the single strongest instability signal.",
    weight: 0.22,
    saturationThreshold: 10,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter((e) => e.severity === "critical");
      return {
        raw: matches.length,
        eventIds: topIds(matches, 5),
        summary: matches.length === 0
          ? "No critical events observed"
          : `${matches.length} critical-severity event${matches.length > 1 ? "s" : ""} active`,
      };
    },
  },

  // ── 2. Military / conflict activity (weight 0.18) ──────────────────────
  {
    id: "military_activity",
    label: "Military & Conflict Activity",
    description: "Active military operations, armed battles, and targeted violence. Sourced from ACLED and GNews military category.",
    weight: 0.18,
    saturationThreshold: 15,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter(
        (e) => e.category === "military" || e.provider === "acled",
      );
      return {
        raw: matches.length,
        eventIds: topIds(matches, 5),
        summary: matches.length === 0
          ? "No active military intelligence"
          : `${matches.length} military / conflict event${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 3. Political instability (weight 0.10) ──────────────────────────────
  {
    id: "political_instab",
    label: "Political Instability",
    description: "High and critical geopolitical events indicating governance crises, coups, sanctions, or diplomatic breakdowns.",
    weight: 0.10,
    saturationThreshold: 20,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter(
        (e) => matchCat(e, ["geopolitics"]) && matchSev(e, ["high", "critical"]),
      );
      return {
        raw: matches.length,
        eventIds: topIds(matches, 5),
        summary: matches.length === 0
          ? "No high-severity political signals"
          : `${matches.length} high-severity geopolitical event${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 4. Natural disasters (weight 0.10) ──────────────────────────────────
  {
    id: "natural_disasters",
    label: "Natural Disaster Activity",
    description: "Active natural disasters including wildfires, floods, volcanoes, and other events tracked by NASA EONET.",
    weight: 0.10,
    saturationThreshold: 10,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter(
        (e) => matchCat(e, ["disaster"]) || e.provider === "nasa_eonet",
      );
      return {
        raw: matches.length,
        eventIds: topIds(matches, 5),
        summary: matches.length === 0
          ? "No active disaster alerts"
          : `${matches.length} natural disaster event${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 5. Earthquake severity (weight 0.10) ────────────────────────────────
  {
    id: "earthquake_severity",
    label: "Earthquake Severity",
    description: "Seismic activity measured by maximum earthquake magnitude from USGS. M6+ triggers full saturation.",
    weight: 0.10,
    saturationThreshold: 6.0,
    rawUnit: "magnitude",
    extract(events) {
      const quakes = events.filter((e) => e.category === "earthquake" || e.provider === "usgs");
      const maxMag = quakes.reduce((max, e) => {
        const mag = typeof e.metadata?.magnitude === "number" ? e.metadata.magnitude as number : 0;
        return Math.max(max, mag);
      }, 0);
      const highQuakes = quakes.filter((e) => matchSev(e, ["high", "critical"]));
      return {
        raw: maxMag,
        eventIds: topIds(highQuakes, 5),
        summary: maxMag === 0
          ? "No significant seismic activity"
          : `Maximum earthquake magnitude M${maxMag.toFixed(1)} (${quakes.length} events)`,
      };
    },
  },

  // ── 6. Economic warnings (weight 0.08) ──────────────────────────────────
  {
    id: "economic_warnings",
    label: "Economic Warning Signals",
    description: "High and critical economic events indicating market instability, inflation crises, or sanctions.",
    weight: 0.08,
    saturationThreshold: 12,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter(
        (e) => matchCat(e, ["economy"]) && matchSev(e, ["high", "critical"]),
      );
      return {
        raw: matches.length,
        eventIds: topIds(matches, 4),
        summary: matches.length === 0
          ? "No high-severity economic signals"
          : `${matches.length} high-severity economic alert${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 7. Cyber threats (weight 0.07) ──────────────────────────────────────
  {
    id: "cyber_threats",
    label: "Cyber Threat Activity",
    description: "Cyberattacks, data breaches, and critical infrastructure incidents.",
    weight: 0.07,
    saturationThreshold: 8,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter((e) => matchCat(e, ["cyber"]));
      return {
        raw: matches.length,
        eventIds: topIds(matches, 4),
        summary: matches.length === 0
          ? "No active cyber threats"
          : `${matches.length} cyber incident${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 8. Weather emergencies (weight 0.06) ────────────────────────────────
  {
    id: "weather_emergencies",
    label: "Weather & Climate Emergencies",
    description: "Severe weather events and climate crises — high and critical only.",
    weight: 0.06,
    saturationThreshold: 10,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter(
        (e) => matchCat(e, ["weather", "climate"]) && matchSev(e, ["high", "critical"]),
      );
      return {
        raw: matches.length,
        eventIds: topIds(matches, 4),
        summary: matches.length === 0
          ? "No severe weather or climate emergencies"
          : `${matches.length} severe weather/climate alert${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 9. Health alerts (weight 0.05) ──────────────────────────────────────
  {
    id: "health_alerts",
    label: "Health & Epidemic Alerts",
    description: "Disease outbreaks, pandemic signals, and healthcare system emergencies.",
    weight: 0.05,
    saturationThreshold: 8,
    rawUnit: "events",
    extract(events) {
      const matches = events.filter((e) => matchCat(e, ["health"]));
      return {
        raw: matches.length,
        eventIds: topIds(matches, 4),
        summary: matches.length === 0
          ? "No active health alerts"
          : `${matches.length} health/epidemic alert${matches.length > 1 ? "s" : ""}`,
      };
    },
  },

  // ── 10. Data quality penalty (weight 0.04) ──────────────────────────────
  {
    id: "data_quality",
    label: "Data Quality Penalty",
    description: "Reduces the score when average provider confidence is low — ensures the index reflects data trustworthiness.",
    weight: 0.04,
    saturationThreshold: 100,
    rawUnit: "score",
    extract(events) {
      const avgConf = events.length > 0
        ? events.reduce((s, e) => s + e.confidence, 0) / events.length
        : 100;
      const penaltyScore = Math.max(0, 100 - avgConf);
      return {
        raw: penaltyScore,
        eventIds: [],
        summary: `Average provider confidence: ${Math.round(avgConf)}%`,
      };
    },
  },
];

// Weight integrity check (development-time assertion)
const totalWeight = FACTOR_SPECS.reduce((s, f) => s + f.weight, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.error(`[DSE] GSI factor weights sum to ${totalWeight.toFixed(4)}, expected 1.0000`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract and normalize all factors from a set of events.
 * Returns the factors sorted by deduction (most impactful first).
 */
export function extractFactors(events: GlobalEvent[]): StabilityFactor[] {
  return FACTOR_SPECS.map((spec) => {
    const { raw, eventIds, summary } = spec.extract(events);
    const normalizedScore = Math.min(1.0, raw / spec.saturationThreshold);
    const deduction = normalizedScore * spec.weight * 100;

    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      weight: spec.weight,
      rawValue: raw,
      rawUnit: spec.rawUnit,
      normalizedScore,
      deduction,
      evidenceEventIds: eventIds,
      evidenceSummary: summary,
    };
  }).sort((a, b) => b.deduction - a.deduction);
}

/** Configurable weight override at runtime (for research / A/B testing). */
export function withWeightOverrides(
  overrides: Partial<Record<string, number>>,
): typeof extractFactors {
  return (events: GlobalEvent[]) => {
    return extractFactors(events).map((f) => {
      const w = overrides[f.id];
      if (w === undefined) return f;
      const deduction = f.normalizedScore * w * 100;
      return { ...f, weight: w, deduction };
    });
  };
}
