/**
 * Emerging Risks Detector
 *
 * Automatically identifies situations that are gaining intensity —
 * not just individual high-severity events, but clusters of activity
 * that together suggest an evolving situation.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DETECTION ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 * An emerging risk is flagged when a country or region shows:
 *
 * Trigger A: Density spike
 *   ≥ DENSITY_THRESHOLD new events (within DENSITY_WINDOW_H hours)
 *   with average severity ≥ "medium"
 *
 * Trigger B: Severity escalation
 *   ≥ 1 critical OR ≥ 2 high events in recent window
 *   from a country with < BASE_COUNT total events (so this is unusual)
 *
 * Trigger C: Multi-category convergence
 *   ≥ CATEGORY_MIN distinct categories from the same country
 *   within the same time window (suggests a multi-dimensional crisis)
 *
 * Confidence factors:
 *   + Provider diversity (more providers = higher confidence)
 *   + Recency (more recent = higher confidence)
 *   + Severity (higher severity = higher confidence)
 *   − Low event count (fewer events = lower confidence)
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { EmergingRisk } from "../models/ReportModel";
import { REGION_COUNTRIES } from "../stability/stabilityEngine";

// ─── Configuration ────────────────────────────────────────────────────────────

const DENSITY_WINDOW_H = 6;
const DENSITY_THRESHOLD = 4;
const CATEGORY_MIN = 3;
const RECENT_WINDOW_H = 24;

const SEVERITY_ORDER: GlobalEventSeverity[] = ["critical", "high", "medium", "low"];

function maxSeverity(events: GlobalEvent[]): GlobalEventSeverity {
  for (const s of SEVERITY_ORDER) {
    if (events.some((e) => e.severity === s)) return s;
  }
  return "low";
}

function avgSeverityScore(events: GlobalEvent[]): number {
  const w = { critical: 4, high: 3, medium: 2, low: 1 };
  return events.reduce((s, e) => s + w[e.severity], 0) / Math.max(1, events.length);
}

function providerDiversity(events: GlobalEvent[]): number {
  return new Set(events.map((e) => e.provider)).size;
}

// ─── Confidence model ─────────────────────────────────────────────────────────

function computeEmergingConfidence(events: GlobalEvent[], trigger: string): number {
  const now = Date.now();
  const recency = events.length > 0
    ? events.reduce((s, e) => s + Math.max(0, 1 - (now - new Date(e.timestamp).getTime()) / (24 * 3600000)), 0) / events.length
    : 0;
  const diversity = Math.min(1, providerDiversity(events) / 3);
  const severity = Math.min(1, avgSeverityScore(events) / 4);
  const volume = Math.min(1, Math.log(events.length + 1) / Math.log(20));

  return Math.round((recency * 0.25 + diversity * 0.25 + severity * 0.30 + volume * 0.20) * 100);
}

// ─── Build an EmergingRisk object ────────────────────────────────────────────

let riskCounter = 0;

function buildEmergingRisk(
  country: string,
  events: GlobalEvent[],
  trigger: string,
  reason: string,
): EmergingRisk {
  const region = Object.entries(REGION_COUNTRIES)
    .find(([, countries]) => countries.some((c) => c.toLowerCase() === country.toLowerCase()))?.[0]
    ?? "Unknown";

  const categories = [...new Set(events.map((e) => e.category))] as GlobalEventCategory[];
  const domCat = categories[0] ?? "general";
  const severity = maxSeverity(events);
  const confidence = computeEmergingConfidence(events, trigger);

  const riskDelta = Math.round(
    events.reduce((s, e) => s + e.riskScore, 0) / Math.max(1, events.length),
  );

  const explanation =
    `${reason} ` +
    `${events.length} event${events.length > 1 ? "s" : ""} detected in ${country} ` +
    `across ${categories.length} category type${categories.length > 1 ? "ies" : "y"} ` +
    `with ${providerDiversity(events)} provider source${providerDiversity(events) > 1 ? "s" : ""}. ` +
    `Confidence: ${confidence}%. This is an algorithmic signal — not a confirmed assessment.`;

  return {
    id: `er-${Date.now()}-${riskCounter++}`,
    title: `Emerging situation: ${country}`,
    region,
    countries: [country],
    category: domCat,
    severity,
    confidence,
    newEventCount: events.length,
    riskDelta,
    reason,
    explanation,
    supportingEvents: events.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    detectedAt: new Date().toISOString(),
  };
}

// ─── Detection logic ──────────────────────────────────────────────────────────

export function detectEmergingRisks(events: GlobalEvent[]): EmergingRisk[] {
  const now = Date.now();
  const recentWindowMs = RECENT_WINDOW_H * 3600000;
  const densityWindowMs = DENSITY_WINDOW_H * 3600000;

  // Group by country
  const byCountry = new Map<string, GlobalEvent[]>();
  for (const e of events) {
    if (!e.country) continue;
    const arr = byCountry.get(e.country) ?? [];
    arr.push(e);
    byCountry.set(e.country, arr);
  }

  const risks: EmergingRisk[] = [];
  const seenCountries = new Set<string>();

  for (const [country, countryEvents] of byCountry) {
    if (seenCountries.has(country)) continue;

    const recentEvents = countryEvents.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && now - t <= recentWindowMs;
    });

    if (recentEvents.length === 0) continue;

    // ── Trigger A: Density spike ──────────────────────────────────────────
    const densityEvents = recentEvents.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return now - t <= densityWindowMs;
    });

    if (
      densityEvents.length >= DENSITY_THRESHOLD &&
      avgSeverityScore(densityEvents) >= 2 // medium or above
    ) {
      risks.push(buildEmergingRisk(
        country,
        densityEvents,
        "density_spike",
        `High event density: ${densityEvents.length} events in ${DENSITY_WINDOW_H} hours.`,
      ));
      seenCountries.add(country);
      continue;
    }

    // ── Trigger B: Severity escalation ────────────────────────────────────
    const criticalEvents = recentEvents.filter((e) => e.severity === "critical");
    const highEvents = recentEvents.filter((e) => e.severity === "high");

    if (criticalEvents.length >= 1 || highEvents.length >= 2) {
      const triggerEvents = [...criticalEvents, ...highEvents];
      risks.push(buildEmergingRisk(
        country,
        triggerEvents,
        "severity_escalation",
        `Severity escalation: ${criticalEvents.length} critical and ${highEvents.length} high-severity events.`,
      ));
      seenCountries.add(country);
      continue;
    }

    // ── Trigger C: Multi-category convergence ─────────────────────────────
    const cats = new Set(recentEvents.map((e) => e.category));
    if (cats.size >= CATEGORY_MIN) {
      risks.push(buildEmergingRisk(
        country,
        recentEvents,
        "category_convergence",
        `Multi-dimensional signal: activity across ${cats.size} distinct event categories.`,
      ));
      seenCountries.add(country);
    }
  }

  // Sort by confidence descending, then by risk delta
  return risks
    .sort((a, b) => b.confidence - a.confidence || b.riskDelta - a.riskDelta)
    .slice(0, 10);
}
