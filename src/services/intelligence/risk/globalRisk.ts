/**
 * Global Risk Index — single composite world-risk score.
 *
 * Derived from the processed IntelligenceEvent pool + earthquake data.
 * Components: military · economic · climate · cyber · health · geological
 *
 * Display:
 *   0–25  → Stable
 *   26–50 → Elevated
 *   51–75 → High
 *   76–100 → Critical
 */
import type { IntelligenceEvent, GlobalRiskIndex, GlobalRiskStatus } from "../types";
import type { Earthquake } from "@/types";
import { SEVERITY_NUMERIC } from "../ranking/severityEngine";

interface ComputeGlobalRiskArgs {
  events: IntelligenceEvent[];
  quakes: Earthquake[];
  /** Optional previous index for trend. */
  previous?: GlobalRiskIndex;
}

/** Extract the most common severe topics for the "topThreats" field. */
function extractTopThreats(events: IntelligenceEvent[]): string[] {
  const counter = new Map<string, number>();
  for (const ev of events) {
    if (ev.importance >= 50 || ev.severity === "critical" || ev.severity === "high") {
      const key = `${ev.category}: ${ev.country ?? "Global"}`;
      counter.set(key, (counter.get(key) ?? 0) + ev.importance);
    }
  }
  return Array.from(counter.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k);
}

/** Map a raw score to the GlobalRiskStatus label. */
function toStatus(score: number): GlobalRiskStatus {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "elevated";
  return "stable";
}

/** Compute a component sub-score for a specific category set. */
function componentScore(events: IntelligenceEvent[], cats: string[]): number {
  const matching = events.filter((e) => cats.includes(e.category));
  if (!matching.length) return 0;
  const totalImp = matching.reduce((s, e) => s + e.importance * SEVERITY_NUMERIC[e.severity], 0);
  // Normalize: sum of (importance × severity) / (number × max_importance × max_severity)
  const max = matching.length * 100 * 4;
  return Math.min(100, Math.round((totalImp / max) * 100 * 3));
}

export function computeGlobalRisk({
  events,
  quakes,
  previous,
}: ComputeGlobalRiskArgs): GlobalRiskIndex {
  const components = {
    military:   componentScore(events, ["military", "geopolitics", "diplomacy"]),
    economic:   componentScore(events, ["economy", "finance", "energy"]),
    climate:    componentScore(events, ["climate", "weather", "environment", "disaster"]),
    cyber:      componentScore(events, ["cybersecurity", "infrastructure"]),
    health:     componentScore(events, ["health"]),
    geological: 0, // derived from earthquakes below
  };

  // Geological: based on significant earthquakes
  const sigQuakes = quakes.filter((q) => q.magnitude >= 5);
  if (sigQuakes.length > 0) {
    const maxMag = Math.max(...sigQuakes.map((q) => q.magnitude));
    const quakeScore = Math.min(100, Math.round(((maxMag - 5) / 4) * 80 + sigQuakes.length * 3));
    components.geological = quakeScore;
  }

  // Composite: weighted average of all components
  const weights = { military: 0.25, economic: 0.20, climate: 0.15, cyber: 0.15, health: 0.15, geological: 0.10 };
  const score = Math.round(
    components.military   * weights.military   +
    components.economic   * weights.economic   +
    components.climate    * weights.climate    +
    components.cyber      * weights.cyber      +
    components.health     * weights.health     +
    components.geological * weights.geological,
  );

  // Trend vs. previous
  let trend: GlobalRiskIndex["trend"] = "stable";
  if (previous) {
    if (score > previous.score + 3) trend = "up";
    else if (score < previous.score - 3) trend = "down";
  }

  return {
    score,
    status: toStatus(score),
    trend,
    components,
    topThreats: extractTopThreats(events),
    computedAt: new Date().toISOString(),
  };
}

/** Color and label for each status. */
export const RISK_STATUS_META: Record<GlobalRiskStatus, { label: string; color: string; bg: string; border: string }> = {
  stable:   { label: "Stable",   color: "text-emerald-glow",  bg: "bg-emerald-glow/10",  border: "border-emerald-glow/30" },
  elevated: { label: "Elevated", color: "text-cyan-glow",     bg: "bg-cyan-glow/10",     border: "border-cyan-glow/30" },
  high:     { label: "High",     color: "text-amber-glow",    bg: "bg-amber-glow/15",    border: "border-amber-glow/30" },
  critical: { label: "Critical", color: "text-rose-glow",     bg: "bg-rose-glow/15",     border: "border-rose-glow/40" },
};
