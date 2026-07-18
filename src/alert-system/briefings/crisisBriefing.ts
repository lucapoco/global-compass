/**
 * AI Crisis Briefing Generator
 *
 * Produces a structured executive briefing for a single CrisisSituation
 * using deterministic logic over real platform data.
 *
 * This module NEVER invents information. Every sentence is derived
 * directly from the alerts, events, and scores that triggered detection.
 * No forward-looking predictions are made — only descriptions of the
 * CURRENT, OBSERVED situation.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { GlobalAlert, CrisisSituation, CrisisBriefing } from "../types";
import { CRISIS_PATTERN_LABELS } from "../types";

// ─── Trend inference ──────────────────────────────────────────────────────────

function inferTrend(events: GlobalEvent[]): CrisisBriefing["currentTrend"] {
  if (events.length < 4) return "insufficient_data";

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgRisk = (arr: GlobalEvent[]) => arr.reduce((s, e) => s + e.riskScore, 0) / arr.length;
  const riskDelta = avgRisk(secondHalf) - avgRisk(firstHalf);

  if (riskDelta > 8) return "escalating";
  if (riskDelta < -8) return "de-escalating";
  return "stable";
}

// ─── Investigation area suggestions ───────────────────────────────────────────

function suggestInvestigationAreas(crisis: CrisisSituation, alerts: GlobalAlert[]): string[] {
  const areas: string[] = [];

  const relevantAlerts = alerts.filter((a) => crisis.alertIds.includes(a.id));
  const lowConfidenceAlerts = relevantAlerts.filter((a) => a.confidence < 60);
  const singleSourceAlerts = relevantAlerts.filter((a) => !a.multiSourceConfirmed);

  if (singleSourceAlerts.length > 0) {
    areas.push(`Seek independent confirmation for ${singleSourceAlerts.length} single-source alert${singleSourceAlerts.length > 1 ? "s" : ""}.`);
  }
  if (lowConfidenceAlerts.length > 0) {
    areas.push(`Review data quality for ${lowConfidenceAlerts.length} lower-confidence alert${lowConfidenceAlerts.length > 1 ? "s" : ""}.`);
  }
  if (crisis.affectedCountries.length > 1) {
    areas.push(`Compare situation severity across affected countries: ${crisis.affectedCountries.slice(0, 3).join(", ")}.`);
  }
  areas.push(`Monitor the Knowledge Graph for newly correlated events in ${crisis.affectedRegions[0] ?? "the affected area"}.`);

  return areas;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateCrisisBriefing(
  crisis: CrisisSituation,
  alerts: GlobalAlert[],
  events: GlobalEvent[],
): CrisisBriefing {
  const supportingEvents = events.filter((e) => crisis.supportingEventIds.includes(e.id));
  const relevantAlerts = alerts.filter((a) => crisis.alertIds.includes(a.id));

  const patternLabel = CRISIS_PATTERN_LABELS[crisis.pattern];

  const situationOverview =
    `${patternLabel} detected in ${crisis.affectedRegions.join(", ") || "an unclassified region"}. ` +
    `${crisis.reason} ` +
    `This situation is supported by ${relevantAlerts.length} active alert${relevantAlerts.length > 1 ? "s" : ""} ` +
    `and ${supportingEvents.length} underlying event${supportingEvents.length > 1 ? "s" : ""}. ` +
    `Composite risk score: ${crisis.riskScore}/100, confidence: ${crisis.confidence}%.`;

  const supportingEvidence = relevantAlerts.slice(0, 5).map(
    (a) => `${a.title}: ${a.explanation}`,
  );

  const trend = inferTrend(supportingEvents);
  const trendLabel: Record<CrisisBriefing["currentTrend"], string> = {
    escalating: "risk indicators are increasing over the observed window",
    stable: "risk indicators have remained stable over the observed window",
    "de-escalating": "risk indicators are decreasing over the observed window",
    insufficient_data: "insufficient event volume to determine a reliable trend",
  };

  return {
    crisisId: crisis.id,
    title: crisis.title,
    situationOverview: `${situationOverview} Current trend: ${trendLabel[trend]}.`,
    affectedRegions: crisis.affectedRegions,
    supportingEvidence,
    relatedEventIds: crisis.supportingEventIds,
    currentTrend: trend,
    confidence: crisis.confidence,
    recommendedInvestigationAreas: suggestInvestigationAreas(crisis, alerts),
    generatedAt: new Date().toISOString(),
  };
}

export function generateAllCrisisBriefings(
  crises: CrisisSituation[],
  alerts: GlobalAlert[],
  events: GlobalEvent[],
): CrisisBriefing[] {
  return crises.map((c) => generateCrisisBriefing(c, alerts, events));
}
