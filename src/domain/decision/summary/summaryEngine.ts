/**
 * Intelligence Summary Engine
 *
 * Generates structured intelligence summaries from real platform data.
 * Text is assembled from data patterns — NO invented content.
 *
 * Summary types supported:
 *   • global          — Platform-wide overview
 *   • regional        — Region-specific summary
 *   • country         — Country-specific summary
 *   • daily_briefing  — What happened today
 *   • weekly_briefing — This week's key themes
 *   • executive       — Condensed for decision-makers
 *   • emergency       — Urgent situation overview
 *
 * Every summary includes:
 *   - Headline (one-line situation assessment)
 *   - Body paragraphs (built from data facts, not fabricated text)
 *   - Key findings (bullet list)
 *   - Data period and event count
 *   - Confidence score
 *
 * The AI chat layer (Gemini) can generate a richer narrative on top of
 * this structured summary; this service only uses deterministic logic.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { GlobalStabilityIndex } from "../models/StabilityIndex";
import { computeGlobalStabilityIndex, computeCountryStabilityIndex, REGION_COUNTRIES } from "../stability/stabilityEngine";
import { CATEGORY_LABELS } from "../analytics/analyticsService";

// ─── Summary type ─────────────────────────────────────────────────────────────

export type SummaryType =
  | "global"
  | "regional"
  | "country"
  | "daily_briefing"
  | "weekly_briefing"
  | "executive"
  | "emergency";

export interface IntelligenceSummary {
  type: SummaryType;
  subject: string;         // "Global", region name, or country name
  headline: string;
  body: string[];          // paragraphs
  keyFindings: string[];
  dataFromLabel: string;   // e.g. "Last 24 hours"
  eventCount: number;
  stabilityScore: number | null;
  confidence: number;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topCategories(events: GlobalEvent[], n = 3): string {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([cat, cnt]) => `${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat} (${cnt})`)
    .join(", ");
}

function recentWindow(events: GlobalEvent[], hours: number): GlobalEvent[] {
  const cutoff = Date.now() - hours * 3_600_000;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

function topCountries(events: GlobalEvent[], n = 5): string[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.country) counts.set(e.country, (counts.get(e.country) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c]) => c);
}

// ─── Summary generators ───────────────────────────────────────────────────────

export function buildGlobalSummary(events: GlobalEvent[]): IntelligenceSummary {
  const gsi = computeGlobalStabilityIndex(events);
  const critCount = events.filter((e) => e.severity === "critical").length;
  const recent24 = recentWindow(events, 24);

  const headline = `Global Stability: ${gsi.tierLabel} — ${gsi.score}/100`;

  const body: string[] = [
    `Global Pulse is currently monitoring ${events.length} intelligence events across all regions. ` +
    `The Global Stability Index stands at ${gsi.score}/100, indicating a ${gsi.tierLabel.toLowerCase()} situation.`,

    critCount > 0
      ? `${critCount} critical-severity event${critCount > 1 ? "s" : ""} are currently active. ` +
        `The most active categories are: ${topCategories(events)}.`
      : `No critical-severity events are currently active. ` +
        `Most active categories: ${topCategories(events)}.`,

    recent24.length > 0
      ? `In the last 24 hours, ${recent24.length} new event${recent24.length > 1 ? "s" : ""} were recorded. ` +
        `The most affected countries include: ${topCountries(recent24, 3).join(", ") || "none identified"}.`
      : `No events have been recorded in the last 24 hours within the current data window.`,
  ];

  const keyFindings: string[] = [
    `Global Stability Index: ${gsi.score}/100 (${gsi.tierLabel})`,
    `Total active events: ${events.length}`,
    critCount > 0 ? `Critical events: ${critCount}` : "No critical events",
    `Top factors: ${gsi.topDrivers.map((f) => f.label).join(", ")}`,
    `Data confidence: ${gsi.confidence.score}%`,
  ];

  return {
    type: "global",
    subject: "Global",
    headline,
    body,
    keyFindings,
    dataFromLabel: "Current event pool",
    eventCount: events.length,
    stabilityScore: gsi.score,
    confidence: gsi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildCountrySummary(events: GlobalEvent[], countryName: string): IntelligenceSummary {
  const countryEvents = events.filter((e) => {
    if (!e.country) return false;
    const t = countryName.toLowerCase();
    const s = e.country.toLowerCase();
    return s === t || s.includes(t) || t.includes(s);
  });

  const csi = computeCountryStabilityIndex(events, countryName);
  const critCount = countryEvents.filter((e) => e.severity === "critical").length;

  const headline = `${countryName}: ${csi.tierLabel} — Stability ${csi.score}/100`;

  const body: string[] = [
    `Global Pulse is tracking ${countryEvents.length} event${countryEvents.length !== 1 ? "s" : ""} attributed to ${countryName}. ` +
    `The Country Stability Index is ${csi.score}/100, indicating a ${csi.tierLabel.toLowerCase()} situation.`,

    countryEvents.length > 0
      ? `Active categories: ${topCategories(countryEvents)}. ` +
        (critCount > 0
          ? `${critCount} critical event${critCount > 1 ? "s" : ""} detected.`
          : "No critical events detected.")
      : `No events are currently attributed to ${countryName} in the platform's data.`,
  ];

  if (csi.topDrivers.length > 0) {
    body.push(
      `Key stability factors: ${csi.topDrivers.map((f) => f.evidenceSummary).join("; ")}.`
    );
  }

  const keyFindings: string[] = [
    `Stability Index: ${csi.score}/100 (${csi.tierLabel})`,
    `Events tracked: ${countryEvents.length}`,
    critCount > 0 ? `Critical events: ${critCount}` : "No critical events",
    ...csi.topDrivers.slice(0, 2).map((f) => f.evidenceSummary),
    `Confidence: ${csi.confidence.score}%`,
  ];

  return {
    type: "country",
    subject: countryName,
    headline,
    body,
    keyFindings,
    dataFromLabel: "Current event pool",
    eventCount: countryEvents.length,
    stabilityScore: csi.score,
    confidence: csi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildRegionalSummary(events: GlobalEvent[], regionName: string): IntelligenceSummary {
  const countries = REGION_COUNTRIES[regionName] ?? [];
  const regionEvents = events.filter((e) =>
    e.country && countries.some((c) => c.toLowerCase() === e.country!.toLowerCase()),
  );

  const gsi = computeGlobalStabilityIndex(regionEvents);
  const critCount = regionEvents.filter((e) => e.severity === "critical").length;
  const topCountriesList = topCountries(regionEvents, 3);

  const headline = `${regionName}: ${gsi.tierLabel} — ${regionEvents.length} events tracked`;

  const body: string[] = [
    `${regionEvents.length} intelligence event${regionEvents.length !== 1 ? "s" : ""} are currently attributed to ${regionName}. ` +
    `The composite stability signal for the region is ${gsi.score}/100 (${gsi.tierLabel}).`,

    topCountriesList.length > 0
      ? `Most active countries in the region: ${topCountriesList.join(", ")}.`
      : `No countries in this region have been identified in the current event pool.`,

    critCount > 0
      ? `${critCount} critical-severity event${critCount > 1 ? "s" : ""} detected in the region.`
      : "No critical events detected in this region.",
  ];

  const keyFindings: string[] = [
    `Regional stability: ${gsi.score}/100`,
    `Active events in region: ${regionEvents.length}`,
    critCount > 0 ? `Critical events: ${critCount}` : "No critical events",
    topCountriesList.length > 0 ? `Most active: ${topCountriesList.join(", ")}` : "No country data",
  ];

  return {
    type: "regional",
    subject: regionName,
    headline,
    body,
    keyFindings,
    dataFromLabel: "Current event pool",
    eventCount: regionEvents.length,
    stabilityScore: gsi.score,
    confidence: gsi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildDailyBriefing(events: GlobalEvent[]): IntelligenceSummary {
  const last24h = recentWindow(events, 24);
  const gsi = computeGlobalStabilityIndex(events);
  const critCount = last24h.filter((e) => e.severity === "critical").length;

  const headline = `Daily Briefing — ${last24h.length} events in the last 24 hours`;

  const body: string[] = [
    `In the last 24 hours, Global Pulse recorded ${last24h.length} new intelligence event${last24h.length !== 1 ? "s" : ""}. ` +
    `The current Global Stability Index is ${gsi.score}/100 (${gsi.tierLabel}).`,

    last24h.length > 0
      ? `Active categories: ${topCategories(last24h)}. ` +
        `Most active countries: ${topCountries(last24h, 3).join(", ") || "none identified"}.`
      : "No recent events were detected in the last 24 hours.",
  ];

  const keyFindings: string[] = [
    `New events (24h): ${last24h.length}`,
    critCount > 0 ? `Critical events: ${critCount}` : "No critical events in the last 24h",
    `Current stability: ${gsi.score}/100 (${gsi.tierLabel})`,
    `Most active categories: ${topCategories(last24h, 2)}`,
  ];

  return {
    type: "daily_briefing",
    subject: "Global",
    headline,
    body,
    keyFindings,
    dataFromLabel: "Last 24 hours",
    eventCount: last24h.length,
    stabilityScore: gsi.score,
    confidence: gsi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildWeeklyBriefing(events: GlobalEvent[]): IntelligenceSummary {
  const last7d = recentWindow(events, 24 * 7);
  const gsi = computeGlobalStabilityIndex(events);

  const headline = `Weekly Briefing — ${last7d.length} events over 7 days`;

  const body: string[] = [
    `Over the past 7 days, Global Pulse recorded ${last7d.length} intelligence events. ` +
    `Current Global Stability stands at ${gsi.score}/100 (${gsi.tierLabel}).`,
    `Top event categories this week: ${topCategories(last7d)}. ` +
    `Most active countries: ${topCountries(last7d, 5).join(", ") || "none identified"}.`,
  ];

  const keyFindings: string[] = [
    `Events this week: ${last7d.length}`,
    `Current stability: ${gsi.score}/100`,
    `Top factors: ${gsi.topDrivers.map((f) => f.label).slice(0, 3).join(", ")}`,
  ];

  return {
    type: "weekly_briefing",
    subject: "Global",
    headline,
    body,
    keyFindings,
    dataFromLabel: "Last 7 days",
    eventCount: last7d.length,
    stabilityScore: gsi.score,
    confidence: gsi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildExecutiveSummary(events: GlobalEvent[], gsi?: GlobalStabilityIndex): IntelligenceSummary {
  const index = gsi ?? computeGlobalStabilityIndex(events);
  const critCount = events.filter((e) => e.severity === "critical").length;
  const topCountriesList = topCountries(events, 5);

  const headline = `Executive Intelligence Summary — Stability ${index.score}/100`;

  const body: string[] = [
    `Situation: ${index.tierLabel}. Global Pulse is monitoring ${events.length} intelligence signals. ` +
    `${critCount > 0 ? `${critCount} critical events require immediate attention.` : "No critical events active."}`,
    `Top concerns: ${index.topDrivers.map((f) => f.evidenceSummary).join("; ")}.`,
    `Most active countries: ${topCountriesList.join(", ") || "Not identified"}.`,
    `Data confidence: ${index.confidence.score}%. ` +
    `Active providers: ${index.confidence.activeProviders.join(", ")}.`,
  ];

  const keyFindings = [
    `Stability: ${index.score}/100 (${index.tierLabel})`,
    ...index.topDrivers.map((f) => f.evidenceSummary),
    `Active providers: ${index.confidence.activeProviders.length}/${5}`,
  ];

  return {
    type: "executive",
    subject: "Global",
    headline,
    body,
    keyFindings,
    dataFromLabel: "Current intelligence pool",
    eventCount: events.length,
    stabilityScore: index.score,
    confidence: index.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}

export function buildEmergencyBriefing(events: GlobalEvent[]): IntelligenceSummary {
  const critical = events.filter((e) => e.severity === "critical");
  const high = events.filter((e) => e.severity === "high");
  const gsi = computeGlobalStabilityIndex(events);

  const headline = `EMERGENCY BRIEFING — ${critical.length} Critical / ${high.length} High-Severity Events Active`;

  const topCritical = critical.slice(0, 5);

  const body: string[] = [
    `⚠ This briefing covers ${critical.length} critical and ${high.length} high-severity events ` +
    `currently tracked by Global Pulse.`,

    topCritical.length > 0
      ? `Critical situations: ${topCritical.map((e) => `${e.title} (${e.country ?? "Unknown"})`).join("; ")}.`
      : "No critical events are currently active.",

    `Global Stability Index: ${gsi.score}/100 (${gsi.tierLabel}). Confidence: ${gsi.confidence.score}%.`,
  ];

  const keyFindings: string[] = [
    `Critical events: ${critical.length}`,
    `High events: ${high.length}`,
    `Stability index: ${gsi.score}/100`,
    ...topCritical.slice(0, 3).map((e) => e.title),
  ];

  return {
    type: "emergency",
    subject: "Global",
    headline,
    body,
    keyFindings,
    dataFromLabel: "Current intelligence pool",
    eventCount: events.length,
    stabilityScore: gsi.score,
    confidence: gsi.confidence.score,
    generatedAt: new Date().toISOString(),
  };
}
