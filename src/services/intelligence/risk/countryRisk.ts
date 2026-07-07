/**
 * Country Risk Engine v2 — enhanced per-country risk assessment.
 *
 * Improvements over riskService.ts:
 *  - Top 20 countries (not 10)
 *  - Trend tracking (up / stable / down) via optional previous snapshot
 *  - Importance score as a factor (not just severity)
 *  - Active event count + critical alert count per country
 *  - Confidence score
 */
import type { IntelligenceEvent, CountryRiskV2 } from "../types";
import type { Earthquake, SavedAlert } from "@/types";
import { SEVERITY_NUMERIC } from "../ranking/severityEngine";

interface BuildCountryRiskArgs {
  events: IntelligenceEvent[];
  quakes: Earthquake[];
  savedAlerts: SavedAlert[];
  /** Optional previous risk snapshot for trend calculation. */
  previousScores?: Map<string, number>;
}

const MAX_COUNTRIES = 20;

/** Derive a label from a 0–100 score. */
function riskLabel(score: number): CountryRiskV2["label"] {
  if (score >= 65) return "Critical";
  if (score >= 40) return "High";
  if (score >= 20) return "Medium";
  return "Low";
}

/** Derive a trend from current vs. previous score. */
function riskTrend(current: number, previous: number | undefined): CountryRiskV2["trend"] {
  if (previous === undefined) return "stable";
  if (current > previous + 5) return "up";
  if (current < previous - 5) return "down";
  return "stable";
}

export function buildCountryRiskV2({
  events,
  quakes,
  savedAlerts,
  previousScores,
}: BuildCountryRiskArgs): CountryRiskV2[] {
  // country → accumulator
  const acc = new Map<
    string,
    { rawScore: number; factors: Map<string, number>; eventCount: number; criticalCount: number }
  >();

  function bump(country: string, label: string, amount: number, isCritical = false) {
    if (!country.trim()) return;
    const entry = acc.get(country) ?? { rawScore: 0, factors: new Map(), eventCount: 0, criticalCount: 0 };
    entry.rawScore += amount;
    entry.factors.set(label, (entry.factors.get(label) ?? 0) + 1);
    entry.eventCount++;
    if (isCritical) entry.criticalCount++;
    acc.set(country, entry);
  }

  // Intelligence events
  for (const ev of events) {
    const country = ev.country;
    if (!country) continue;

    // Base contribution from severity
    const sevPts = { critical: 20, high: 12, medium: 6, low: 2 };
    const base = sevPts[ev.severity] ?? 2;

    // Importance multiplier (1.0–1.5 for importance 0–100)
    const mult = 1 + (ev.importance / 200);
    const pts = Math.round(base * mult);

    bump(country, `${ev.severity} event`, pts, ev.severity === "critical");

    // Also bump countries extracted from entities
    for (const c of ev.entities.countries.slice(0, 2)) {
      if (c !== country) bump(c, "mentioned country", Math.round(pts * 0.4));
    }
  }

  // Earthquakes
  for (const q of quakes) {
    const tail = q.place?.split(",").pop()?.trim();
    if (!tail) continue;
    if (q.magnitude >= 7) bump(tail, "M7+ earthquake", 30, true);
    else if (q.magnitude >= 6) bump(tail, "M6+ earthquake", 22);
    else if (q.magnitude >= 5) bump(tail, "M5+ earthquake", 12);
  }

  // Saved alerts
  for (const sa of savedAlerts) {
    if (!sa.location) continue;
    if (sa.severity === "Critical") bump(sa.location, "saved critical alert", 18, true);
    else if (sa.severity === "High") bump(sa.location, "saved high alert", 10);
  }

  const now = new Date().toISOString();
  const results: CountryRiskV2[] = [];

  for (const [country, data] of acc.entries()) {
    const score = Math.min(100, Math.round(data.rawScore));
    const factors: string[] = [];
    for (const [label, count] of data.factors.entries()) {
      factors.push(count > 1 ? `${count}× ${label}` : label);
    }

    results.push({
      country,
      score,
      label: riskLabel(score),
      trend: riskTrend(score, previousScores?.get(country)),
      activeEvents: data.eventCount,
      criticalAlerts: data.criticalCount,
      topRisks: factors.slice(0, 4),
      confidence: Math.min(90, 40 + data.eventCount * 5),
      lastUpdated: now,
    });
  }

  return results
    .sort((a, b) => b.score - a.score || SEVERITY_NUMERIC[b.label.toLowerCase() as keyof typeof SEVERITY_NUMERIC] - SEVERITY_NUMERIC[a.label.toLowerCase() as keyof typeof SEVERITY_NUMERIC])
    .slice(0, MAX_COUNTRIES);
}
