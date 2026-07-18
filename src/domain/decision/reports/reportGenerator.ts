/**
 * Executive Report Generator
 *
 * Assembles structured ExecutiveReport objects suitable for rendering in the UI
 * and exporting to PDF (via the print/export layer).
 *
 * Supported report types:
 *   • global         — Full global intelligence overview
 *   • country        — Focused country intelligence report
 *   • regional       — Regional overview
 *   • daily_briefing — Daily situation digest
 *   • weekly_briefing — Weekly intelligence wrap-up
 *   • emergency       — Emergency situation brief
 *
 * Report structure:
 *   Section 1: Executive Summary
 *   Section 2: Stability Assessment
 *   Section 3: Key Events
 *   Section 4: Risk Factors
 *   Section 5: Category Breakdown
 *   Section 6: Regional Situation (global reports only)
 *   Section 7: Recommendations
 *   Section 8: Methodology & Data Sources
 *
 * Classification notice:
 *   All reports carry "UNCLASSIFIED // FOR EDUCATIONAL USE" as they are
 *   generated from open-source intelligence for the InfoEducație competition.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { ExecutiveReport, ReportType, Recommendation } from "../models/ReportModel";
import { computeGlobalStabilityIndex, computeCountryStabilityIndex, computeRegionalStabilityIndex } from "../stability/stabilityEngine";
import { buildAnalyticsSummary, computeCategoryBreakdown } from "../analytics/analyticsService";
import { buildGlobalSummary, buildCountrySummary, buildRegionalSummary, buildDailyBriefing, buildWeeklyBriefing, buildEmergencyBriefing } from "../summary/summaryEngine";
import { detectEmergingRisks } from "../emerging/emergingRisks";
import { REGION_COUNTRIES } from "../stability/stabilityEngine";
import type { WorldBankIndicators } from "@/domain/gpie/models/WorldBankData";

// ─── Unique ID ────────────────────────────────────────────────────────────────

let reportCounter = 0;
function nextReportId(type: ReportType): string {
  return `rpt-${type}-${Date.now()}-${reportCounter++}`;
}

// ─── Recommendation generator ─────────────────────────────────────────────────

function generateRecommendations(
  events: GlobalEvent[],
  subject: string,
): Recommendation[] {
  const recs: Recommendation[] = [];
  let counter = 0;

  const critical = events.filter((e) => e.severity === "critical");
  const high = events.filter((e) => e.severity === "high");
  const emerging = detectEmergingRisks(events);

  if (critical.length > 0) {
    recs.push({
      id: `rec-${++counter}`,
      title: `Monitor ${critical.length} active critical event${critical.length > 1 ? "s" : ""}`,
      body: `${critical.length} critical-severity event${critical.length > 1 ? "s are" : " is"} currently active and warrant immediate attention. ` +
        `Evidence: ${critical.slice(0, 3).map((e) => `"${e.title}"`).join(", ")}.`,
      priority: "immediate",
      category: "security_alert",
      evidenceEventIds: critical.slice(0, 5).map((e) => e.id),
      evidenceSummary: `${critical.length} critical events`,
      affectedCountries: [...new Set(critical.map((e) => e.country).filter(Boolean) as string[])].slice(0, 5),
      confidence: 90,
      generatedAt: new Date().toISOString(),
    });
  }

  for (const risk of emerging.slice(0, 3)) {
    recs.push({
      id: `rec-${++counter}`,
      title: `Watch emerging situation: ${risk.countries[0]}`,
      body: risk.explanation,
      priority: risk.severity === "critical" ? "high" : "monitor",
      category: "emerging_risk",
      evidenceEventIds: risk.supportingEvents.map((e) => e.id),
      evidenceSummary: risk.reason,
      affectedCountries: risk.countries,
      confidence: risk.confidence,
      generatedAt: new Date().toISOString(),
    });
  }

  if (high.length > 5) {
    const countries = [...new Set(high.map((e) => e.country).filter(Boolean) as string[])];
    recs.push({
      id: `rec-${++counter}`,
      title: `${high.length} high-severity events across ${countries.length} countries`,
      body: `A significant number of high-severity events are active. Most affected: ${countries.slice(0, 5).join(", ")}.`,
      priority: "monitor",
      category: "general",
      evidenceEventIds: high.slice(0, 5).map((e) => e.id),
      evidenceSummary: `${high.length} high-severity events`,
      affectedCountries: countries.slice(0, 5),
      confidence: 75,
      generatedAt: new Date().toISOString(),
    });
  }

  return recs.slice(0, 5);
}

// ─── Section builders ─────────────────────────────────────────────────────────

function methodologySection(providers: string[]): { title: string; content: string } {
  return {
    title: "Methodology & Data Sources",
    content:
      `This report was generated automatically by Global Pulse's Decision Support Engine ` +
      `using exclusively open-source intelligence signals from the following providers: ` +
      `${providers.join(", ")}.\n\n` +
      `The Global Stability Index (GSI) is an original algorithm developed for the ` +
      `InfoEducație competition. It computes a 0–100 score by combining ten weighted factors ` +
      `(critical events, military activity, natural disasters, earthquakes, political instability, ` +
      `economic signals, cyber threats, weather emergencies, health alerts, and data quality). ` +
      `No external benchmark data or predictions are used. All values reflect real-time ` +
      `API responses at the time of report generation.\n\n` +
      `Classification: UNCLASSIFIED — FOR EDUCATIONAL USE ONLY`,
  };
}

// ─── Report assemblers ────────────────────────────────────────────────────────

export function generateGlobalReport(events: GlobalEvent[]): ExecutiveReport {
  const gsi = computeGlobalStabilityIndex(events);
  const rsi = computeRegionalStabilityIndex(events);
  const analytics = buildAnalyticsSummary(events);
  const summary = buildGlobalSummary(events);
  const recommendations = generateRecommendations(events, "Global");

  const now = new Date().toISOString();
  const providers = [...new Set(events.map((e) => e.provider))];

  return {
    id: nextReportId("global"),
    type: "global",
    title: "Global Intelligence Report",
    subtitle: `Stability: ${gsi.tierLabel} (${gsi.score}/100)`,
    subject: "Global",
    classification: "UNCLASSIFIED // FOR EDUCATIONAL USE",
    generatedAt: now,
    dataFrom: gsi.dataFrom,
    dataTo: gsi.dataTo,

    executiveSummary: summary.body.join(" "),
    keyFindings: summary.keyFindings,

    sections: [
      {
        title: "Stability Assessment",
        content: `Global Stability Index: ${gsi.score}/100 (${gsi.tierLabel}). ` +
          gsi.topDrivers.map((f) => f.evidenceSummary).join(". "),
        data: { gsi },
      },
      {
        title: "Key Events",
        content: `${events.filter((e) => e.severity === "critical").length} critical events, ` +
          `${events.filter((e) => e.severity === "high").length} high-severity events active.`,
        data: { topEvents: events.filter((e) => e.severity !== "low").slice(0, 10) },
      },
      {
        title: "Category Breakdown",
        content: analytics.categoryBreakdown
          .slice(0, 5)
          .map((c) => `${c.label}: ${c.count} events (avg risk ${c.avgRisk})`)
          .join(". "),
        data: { categoryBreakdown: analytics.categoryBreakdown },
      },
      {
        title: "Regional Stability",
        content: rsi.entries
          .slice(0, 7)
          .map((r) => `${r.region}: ${r.score}/100 (${r.tierLabel})`)
          .join(" | "),
        data: { rsi },
      },
      methodologySection(providers),
    ],

    stabilityScore: gsi.score,
    stabilityTier: gsi.tier,
    topEvents: events
      .filter((e) => ["critical", "high"].includes(e.severity))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10),
    recommendations,

    sourceProviders: providers,
    eventCount: events.length,
    confidence: gsi.confidence.score,
    metadata: { gsi, analytics, rsi },
  };
}

export function generateCountryReport(
  events: GlobalEvent[],
  countryName: string,
  worldBankData: WorldBankIndicators | null = null,
): ExecutiveReport {
  const countryEvents = events.filter((e) => {
    if (!e.country) return false;
    const t = countryName.toLowerCase();
    const s = e.country.toLowerCase();
    return s === t || s.includes(t) || t.includes(s);
  });

  const csi = computeCountryStabilityIndex(events, countryName);
  const summary = buildCountrySummary(events, countryName);
  const recommendations = generateRecommendations(countryEvents, countryName);
  const providers = [...new Set(countryEvents.map((e) => e.provider))];
  const now = new Date().toISOString();

  const categoryBreakdown = computeCategoryBreakdown(countryEvents);

  return {
    id: nextReportId("country"),
    type: "country",
    title: `${countryName} Intelligence Report`,
    subtitle: `Stability: ${csi.tierLabel} (${csi.score}/100)`,
    subject: countryName,
    classification: "UNCLASSIFIED // FOR EDUCATIONAL USE",
    generatedAt: now,
    dataFrom: now,
    dataTo: now,

    executiveSummary: summary.body.join(" "),
    keyFindings: summary.keyFindings,

    sections: [
      {
        title: "Country Stability Assessment",
        content: `Country Stability Index: ${csi.score}/100 (${csi.tierLabel}). ` +
          csi.topDrivers.map((f) => f.evidenceSummary).join(". "),
        data: { csi },
      },
      {
        title: "Key Events",
        content: `${countryEvents.length} total events. ` +
          `Critical: ${countryEvents.filter((e) => e.severity === "critical").length}. ` +
          `High: ${countryEvents.filter((e) => e.severity === "high").length}.`,
        data: { events: countryEvents.slice(0, 10) },
      },
      {
        title: "Category Breakdown",
        content: categoryBreakdown
          .slice(0, 4)
          .map((c) => `${c.label}: ${c.count}`)
          .join(", "),
        data: { categoryBreakdown },
      },
      ...(worldBankData ? [{
        title: "Economic Profile (World Bank)",
        content: [
          worldBankData.gdpPerCapitaUSD != null ? `GDP per capita: $${worldBankData.gdpPerCapitaUSD.toLocaleString()}` : null,
          worldBankData.population != null ? `Population: ${worldBankData.population.toLocaleString()}` : null,
          worldBankData.unemploymentPct != null ? `Unemployment: ${worldBankData.unemploymentPct.toFixed(1)}%` : null,
        ].filter(Boolean).join(" | "),
        data: { worldBankData },
      }] : []),
      methodologySection(providers),
    ],

    stabilityScore: csi.score,
    stabilityTier: csi.tier,
    topEvents: countryEvents
      .filter((e) => ["critical", "high"].includes(e.severity))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10),
    recommendations,

    sourceProviders: providers,
    eventCount: countryEvents.length,
    confidence: csi.confidence.score,
    metadata: { csi, worldBankData },
  };
}

export function generateRegionalReport(events: GlobalEvent[], regionName: string): ExecutiveReport {
  const countries = REGION_COUNTRIES[regionName] ?? [];
  const regionEvents = events.filter((e) =>
    e.country && countries.some((c) => c.toLowerCase() === e.country!.toLowerCase()),
  );

  const gsi = computeGlobalStabilityIndex(regionEvents);
  const summary = buildRegionalSummary(events, regionName);
  const recommendations = generateRecommendations(regionEvents, regionName);
  const providers = [...new Set(regionEvents.map((e) => e.provider))];
  const now = new Date().toISOString();

  return {
    id: nextReportId("regional"),
    type: "regional",
    title: `${regionName} Regional Intelligence Report`,
    subtitle: `${regionEvents.length} events tracked`,
    subject: regionName,
    classification: "UNCLASSIFIED // FOR EDUCATIONAL USE",
    generatedAt: now,
    dataFrom: now,
    dataTo: now,

    executiveSummary: summary.body.join(" "),
    keyFindings: summary.keyFindings,

    sections: [
      {
        title: "Regional Stability Assessment",
        content: `Composite stability for ${regionName}: ${gsi.score}/100 (${gsi.tierLabel}).`,
        data: { gsi },
      },
      {
        title: "Most Active Countries",
        content: (() => {
          const counts = new Map<string, number>();
          for (const e of regionEvents) if (e.country) counts.set(e.country, (counts.get(e.country) ?? 0) + 1);
          return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([c, n]) => `${c}: ${n} events`).join(", ");
        })(),
        data: {},
      },
      methodologySection(providers),
    ],

    stabilityScore: gsi.score,
    stabilityTier: gsi.tier,
    topEvents: regionEvents.filter((e) => ["critical", "high"].includes(e.severity)).slice(0, 8),
    recommendations,

    sourceProviders: providers,
    eventCount: regionEvents.length,
    confidence: gsi.confidence.score,
    metadata: { gsi },
  };
}

export function generateDailyBriefing(events: GlobalEvent[]): ExecutiveReport {
  const summary = buildDailyBriefing(events);
  const gsi = computeGlobalStabilityIndex(events);
  const recommendations = generateRecommendations(events, "Daily");
  const now = new Date().toISOString();
  const providers = [...new Set(events.map((e) => e.provider))];

  return {
    id: nextReportId("daily_briefing"),
    type: "daily_briefing",
    title: "Daily Intelligence Briefing",
    subtitle: `${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    subject: "Global",
    classification: "UNCLASSIFIED // FOR EDUCATIONAL USE",
    generatedAt: now,
    dataFrom: new Date(Date.now() - 86_400_000).toISOString(),
    dataTo: now,

    executiveSummary: summary.body.join(" "),
    keyFindings: summary.keyFindings,

    sections: [
      {
        title: "Today's Situation",
        content: summary.body.join("\n\n"),
        data: {},
      },
      methodologySection(providers),
    ],

    stabilityScore: gsi.score,
    stabilityTier: gsi.tier,
    topEvents: events
      .filter((e) => Date.now() - new Date(e.timestamp).getTime() <= 86_400_000)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10),
    recommendations,

    sourceProviders: providers,
    eventCount: events.length,
    confidence: gsi.confidence.score,
    metadata: {},
  };
}

export function generateEmergencyBriefing(events: GlobalEvent[]): ExecutiveReport {
  const summary = buildEmergencyBriefing(events);
  const gsi = computeGlobalStabilityIndex(events);
  const recommendations = generateRecommendations(events, "Emergency");
  const now = new Date().toISOString();
  const providers = [...new Set(events.map((e) => e.provider))];

  return {
    id: nextReportId("emergency"),
    type: "emergency",
    title: "Emergency Intelligence Briefing",
    subtitle: `${events.filter((e) => e.severity === "critical").length} Critical Events Active`,
    subject: "Global",
    classification: "UNCLASSIFIED // FOR EDUCATIONAL USE — ALGORITHMIC ASSESSMENT",
    generatedAt: now,
    dataFrom: now,
    dataTo: now,

    executiveSummary: summary.body.join(" "),
    keyFindings: summary.keyFindings,

    sections: [
      {
        title: "Critical Situation Overview",
        content: summary.body.join("\n\n"),
        data: {},
      },
      methodologySection(providers),
    ],

    stabilityScore: gsi.score,
    stabilityTier: gsi.tier,
    topEvents: events.filter((e) => e.severity === "critical").slice(0, 10),
    recommendations,

    sourceProviders: providers,
    eventCount: events.length,
    confidence: gsi.confidence.score,
    metadata: {},
  };
}
