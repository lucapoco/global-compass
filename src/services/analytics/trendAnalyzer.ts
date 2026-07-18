/**
 * Trend Analyzer — GP-012 core service.
 *
 * Pure TypeScript module (no React, no side effects) that derives
 * trend indicators from the current intelligence feed.
 *
 * Design principles:
 *  • Never predicts the future — only describes observable change direction.
 *  • All trends are explained with specific, quantifiable factors.
 *  • Window-based comparison: "recent" (0–6h) vs "baseline" (6–24h ago).
 *  • Confidence reflects sample size — low confidence with sparse data.
 *
 * Architecture: Strategy pattern — each metric (count, severity, velocity)
 * contributes independently to the final trend score.
 */

import type { IntelligenceItem, Earthquake } from "@/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type TrendDirection = "increasing" | "stable" | "improving";
export type TrendMagnitude = "slight" | "moderate" | "significant";

export interface CategoryTrend {
  category: string;
  direction: TrendDirection;
  magnitude: TrendMagnitude;
  recentCount: number;
  baselineCount: number;
  recentCritical: number;
  explanation: string;
}

export interface CountryTrend {
  country: string;
  direction: TrendDirection;
  recentCount: number;
  baselineCount: number;
  topSeverity: string;
  explanation: string;
}

export interface GlobalTrend {
  direction: TrendDirection;
  magnitude: TrendMagnitude;
  confidence: number;          // 0–100
  label: string;               // human-readable one-liner
  explanation: string;         // 2–3 sentence analysis
  factors: string[];           // enumerated contributing factors
  metrics: TrendMetrics;
  byCategory: CategoryTrend[];
  byCountry: CountryTrend[];
  computedAt: string;
}

export interface TrendMetrics {
  recentCount: number;
  baselineCount: number;
  recentCritical: number;
  baselineCritical: number;
  recentHigh: number;
  baselineHigh: number;
  severityScore: number;       // weighted recent severity
  baselineSeverityScore: number;
  velocityRatio: number;       // recent/hr ÷ baseline/hr
  severityRatio: number;       // recent weighted ÷ baseline weighted
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_WINDOW_MS  = 6 * 3_600_000;  // 0–6 h
const BASELINE_START_MS = 6 * 3_600_000;  // start: 6 h ago
const BASELINE_END_MS   = 24 * 3_600_000; // end: 24 h ago

const SEV_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TRACKED_CATEGORIES = [
  "military", "politics", "economy", "cyber", "climate", "health", "disaster", "technology", "general",
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sevScore(items: IntelligenceItem[]): number {
  return items.reduce((s, i) => s + (SEV_WEIGHTS[i.severity] ?? 1), 0);
}

function directionFromRatio(ratio: number): TrendDirection {
  if (ratio > 1.25) return "increasing";
  if (ratio < 0.75) return "improving";
  return "stable";
}

function magnitudeFromRatio(ratio: number): TrendMagnitude {
  const delta = Math.abs(ratio - 1);
  if (delta > 0.8) return "significant";
  if (delta > 0.35) return "moderate";
  return "slight";
}

function confidence(recentCount: number, baselineCount: number): number {
  const total = recentCount + baselineCount;
  if (total === 0) return 0;
  if (total < 5) return 20;
  if (total < 15) return 50;
  if (total < 30) return 75;
  return 90;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeTrends(
  intel: IntelligenceItem[],
  quakes: Earthquake[] = [],
): GlobalTrend {
  const now = Date.now();

  const recent = intel.filter((i) => {
    const age = now - new Date(i.publishedAt).getTime();
    return age >= 0 && age < RECENT_WINDOW_MS;
  });

  const baseline = intel.filter((i) => {
    const age = now - new Date(i.publishedAt).getTime();
    return age >= BASELINE_START_MS && age < BASELINE_END_MS;
  });

  // ── Global metrics ──────────────────────────────────────────────────────────
  const recentCritical = recent.filter((i) => i.severity === "critical").length;
  const baselineCritical = baseline.filter((i) => i.severity === "critical").length;
  const recentHigh = recent.filter((i) => i.severity === "high").length;
  const baselineHigh = baseline.filter((i) => i.severity === "high").length;

  const recentSev = sevScore(recent);
  const baselineSev = sevScore(baseline);

  // Normalise to per-hour rate to make windows comparable
  const recentRate = recent.length / 6;
  const baselineRate = baseline.length / 18;

  const velocityRatio = baselineRate > 0 ? recentRate / baselineRate : (recent.length > 0 ? 2 : 1);
  const severityRatio = baselineSev > 0 ? recentSev / baselineSev : (recentSev > 0 ? 2 : 1);

  // Combined ratio (60 % severity, 40 % velocity)
  const combinedRatio = severityRatio * 0.6 + velocityRatio * 0.4;

  const direction = directionFromRatio(combinedRatio);
  const magnitude = magnitudeFromRatio(combinedRatio);
  const conf = confidence(recent.length, baseline.length);

  const metrics: TrendMetrics = {
    recentCount: recent.length,
    baselineCount: baseline.length,
    recentCritical,
    baselineCritical,
    recentHigh,
    baselineHigh,
    severityScore: recentSev,
    baselineSeverityScore: baselineSev,
    velocityRatio: +velocityRatio.toFixed(2),
    severityRatio: +severityRatio.toFixed(2),
  };

  // ── Build explanation ───────────────────────────────────────────────────────
  const factors: string[] = [];
  if (recentCritical > 0) factors.push(`${recentCritical} critical event${recentCritical > 1 ? "s" : ""} in last 6h`);
  if (recentCritical > baselineCritical) factors.push("critical count rising vs previous window");
  if (recentCritical < baselineCritical && baselineCritical > 0) factors.push("critical count declining vs previous window");
  if (velocityRatio > 1.3) factors.push(`event rate +${Math.round((velocityRatio - 1) * 100)}% above baseline`);
  if (velocityRatio < 0.7) factors.push(`event rate −${Math.round((1 - velocityRatio) * 100)}% below baseline`);
  if (quakes.filter((q) => q.magnitude >= 5.5).length > 2) factors.push("multiple significant earthquakes detected");
  if (factors.length === 0) factors.push("activity within normal operational parameters");

  const dirLabel = direction === "increasing"
    ? `Increasing ${magnitude === "significant" ? "rapidly" : "steadily"}`
    : direction === "improving"
    ? `Improving ${magnitude === "significant" ? "significantly" : "gradually"}`
    : "Stable";

  const explanation = buildExplanation(direction, magnitude, metrics, factors);

  // ── Per-category trends ─────────────────────────────────────────────────────
  const byCategory: CategoryTrend[] = TRACKED_CATEGORIES.map((cat) => {
    const rCat = recent.filter((i) => i.category?.toLowerCase().includes(cat));
    const bCat = baseline.filter((i) => i.category?.toLowerCase().includes(cat));
    const rSev = sevScore(rCat);
    const bSev = sevScore(bCat);
    const rRate = rCat.length / 6;
    const bRate = bCat.length / 18;
    const vRatio = bRate > 0 ? rRate / bRate : rCat.length > 0 ? 2 : 1;
    const sRatio = bSev > 0 ? rSev / bSev : rSev > 0 ? 2 : 1;
    const cRatio = sRatio * 0.6 + vRatio * 0.4;
    const dir = directionFromRatio(cRatio);
    const mag = magnitudeFromRatio(cRatio);
    const rCrit = rCat.filter((i) => i.severity === "critical").length;

    return {
      category: cat,
      direction: dir,
      magnitude: mag,
      recentCount: rCat.length,
      baselineCount: bCat.length,
      recentCritical: rCrit,
      explanation: buildCategoryExplanation(cat, dir, rCat.length, bCat.length, rCrit),
    };
  }).filter((c) => c.recentCount + c.baselineCount > 0);

  // ── Per-country trends ──────────────────────────────────────────────────────
  const allCountries = [...new Set([...recent, ...baseline].map((i) => i.country).filter(Boolean) as string[])];

  const byCountry: CountryTrend[] = allCountries
    .map((country) => {
      const rC = recent.filter((i) => i.country === country);
      const bC = baseline.filter((i) => i.country === country);
      const rRate2 = rC.length / 6;
      const bRate2 = bC.length / 18;
      const vR = bRate2 > 0 ? rRate2 / bRate2 : rC.length > 0 ? 2 : 1;
      const dir = directionFromRatio(vR);
      const topSev = rC.length > 0
        ? (rC.some((i) => i.severity === "critical") ? "critical"
          : rC.some((i) => i.severity === "high") ? "high"
          : "medium")
        : "low";

      return {
        country,
        direction: dir,
        recentCount: rC.length,
        baselineCount: bC.length,
        topSeverity: topSev,
        explanation: `${rC.length} events in last 6h vs ${bC.length} events in prior window.`,
      };
    })
    .filter((c) => c.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount)
    .slice(0, 15);

  return {
    direction,
    magnitude,
    confidence: conf,
    label: dirLabel,
    explanation,
    factors,
    metrics,
    byCategory,
    byCountry,
    computedAt: new Date().toISOString(),
  };
}

// ─── Text builders ────────────────────────────────────────────────────────────

function buildExplanation(
  direction: TrendDirection,
  magnitude: TrendMagnitude,
  m: TrendMetrics,
  factors: string[],
): string {
  const vel = m.velocityRatio > 1
    ? `Event velocity is ${Math.round((m.velocityRatio - 1) * 100)}% above the 18-hour baseline.`
    : m.velocityRatio < 1
    ? `Event velocity is ${Math.round((1 - m.velocityRatio) * 100)}% below the 18-hour baseline.`
    : "Event velocity is consistent with the 18-hour baseline.";

  const sev = m.recentCritical > 0
    ? `${m.recentCritical} critical and ${m.recentHigh} high-priority events detected in the last 6 hours.`
    : m.recentHigh > 0
    ? `${m.recentHigh} high-priority events detected in the last 6 hours, no critical alerts.`
    : "No critical or high-priority events in the recent window.";

  const conclusion = direction === "increasing"
    ? "Overall intelligence activity is trending upward. Enhanced monitoring recommended."
    : direction === "improving"
    ? "Intelligence activity is declining from prior levels. Situation appears to be stabilizing."
    : "The global intelligence picture is holding steady. Normal operational monitoring applies.";

  return `${vel} ${sev} ${conclusion}`;
}

function buildCategoryExplanation(
  cat: string,
  dir: TrendDirection,
  recent: number,
  baseline: number,
  critical: number,
): string {
  if (recent === 0 && baseline === 0) return "No activity detected.";
  if (dir === "increasing") return `${recent} recent events vs ${baseline} in baseline window${critical > 0 ? `; ${critical} critical` : ""}. Activity rising.`;
  if (dir === "improving") return `${recent} recent events vs ${baseline} in baseline. ${cat.charAt(0).toUpperCase() + cat.slice(1)} activity declining.`;
  return `${recent} recent events, consistent with baseline (${baseline}). ${cat.charAt(0).toUpperCase() + cat.slice(1)} situation stable.`;
}
