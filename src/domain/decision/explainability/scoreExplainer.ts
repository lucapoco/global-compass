/**
 * Score Explainer
 *
 * Converts any stability index or risk score into a structured, human-readable
 * explanation that the UI can render.  Every number displayed in Global Pulse
 * should have an associated explanation that can be shown on demand.
 *
 * Design contract:
 *   • NEVER state predictions ("This will lead to...")
 *   • NEVER claim scientific certainty
 *   • ALWAYS cite the evidence used
 *   • ALWAYS expose the confidence level
 *   • ALWAYS describe the methodology briefly
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { GlobalStabilityIndex, CountryStabilityIndex, StabilityFactor } from "../models/StabilityIndex";

// ─── Explanation types ────────────────────────────────────────────────────────

export interface ScoreBullet {
  label: string;
  value: string;
  impact: "high" | "medium" | "low";
}

export interface ScoreExplanation {
  /** The score being explained. */
  score: number;
  /** Short label for the score (e.g. "Stability Score"). */
  scoreLabel: string;
  /** One-sentence interpretation of the score. */
  interpretation: string;
  /** Bullet-point breakdown of what contributed. */
  bullets: ScoreBullet[];
  /** Methodology note — always shown to the user. */
  methodologyNote: string;
  /** Overall confidence in this explanation. */
  confidence: number;
  confidenceLabel: string;
  /** Total number of events that contributed to this score. */
  evidenceCount: number;
  calculatedAt: string;
}

// ─── Confidence label ─────────────────────────────────────────────────────────

function confidenceLabel(confidence: number): string {
  if (confidence >= 85) return "High confidence";
  if (confidence >= 65) return "Moderate confidence";
  if (confidence >= 45) return "Low confidence";
  return "Very low confidence — limited data";
}

// ─── Factor → bullet ──────────────────────────────────────────────────────────

function factorToBullet(factor: StabilityFactor): ScoreBullet {
  const impact: ScoreBullet["impact"] =
    factor.deduction >= 10 ? "high" :
    factor.deduction >= 4  ? "medium" : "low";

  const deductionStr = factor.deduction.toFixed(1);
  const label = factor.rawValue > 0
    ? `${factor.label}: ${factor.evidenceSummary} (−${deductionStr} pts)`
    : `${factor.label}: ${factor.evidenceSummary}`;

  return { label, value: `−${deductionStr}`, impact };
}

// ─── Interpretation text ──────────────────────────────────────────────────────

function interpretGSI(score: number, tierLabel: string): string {
  const band = Math.floor(score / 20);
  const phrases: Record<number, string> = {
    5: "Current signals indicate low global activity. The platform is observing few concerning events.",
    4: "Moderate activity detected. Several elevated signals are present, but no widespread instability.",
    3: "Elevated instability signals. Multiple regions or categories are showing concerning activity.",
    2: "Significant instability observed across multiple dimensions. Situational awareness recommended.",
    1: "Widespread instability observed. Multiple high-severity situations are active simultaneously.",
    0: "Extreme instability conditions observed across the platform's monitored events.",
  };
  return `${tierLabel} (${score}/100) — ${phrases[Math.min(band, 5)]}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a full ScoreExplanation for a Global Stability Index.
 */
export function explainGSI(gsi: GlobalStabilityIndex): ScoreExplanation {
  const bullets: ScoreBullet[] = [
    // Active factors (those with deduction > 0)
    ...gsi.factors
      .filter((f) => f.rawValue > 0)
      .slice(0, 8)
      .map(factorToBullet),
    // Confidence row
    {
      label: `Data quality: ${gsi.confidence.activeProviders.length} active providers, ${gsi.confidence.liveEvents} live events`,
      value: `${gsi.confidence.score}% confidence`,
      impact: "low",
    },
  ];

  return {
    score: gsi.score,
    scoreLabel: "Global Stability Index",
    interpretation: interpretGSI(gsi.score, gsi.tierLabel),
    bullets,
    methodologyNote:
      "Score = 100 − Σ(factor_weight × normalized_evidence). " +
      "Each factor is normalized using a saturation threshold. " +
      "All values derived exclusively from real provider data — no forecasting applied.",
    confidence: gsi.confidence.score,
    confidenceLabel: confidenceLabel(gsi.confidence.score),
    evidenceCount: gsi.eventCount,
    calculatedAt: gsi.calculatedAt,
  };
}

/**
 * Generate a full ScoreExplanation for a Country Stability Index.
 */
export function explainCSI(csi: CountryStabilityIndex): ScoreExplanation {
  const bullets: ScoreBullet[] = [
    ...csi.factors
      .filter((f) => f.rawValue > 0)
      .slice(0, 6)
      .map(factorToBullet),
    {
      label: `Based on ${csi.eventCount} events attributed to ${csi.countryName}`,
      value: `${csi.confidence.score}% confidence`,
      impact: "low",
    },
  ];

  return {
    score: csi.score,
    scoreLabel: `${csi.countryName} Stability Index`,
    interpretation: `${csi.tierLabel} (${csi.score}/100) — Score based on ${csi.eventCount} events attributed to ${csi.countryName}.`,
    bullets,
    methodologyNote:
      "Same GSI algorithm applied to country-filtered events. " +
      "Low event counts reduce confidence in the score.",
    confidence: csi.confidence.score,
    confidenceLabel: confidenceLabel(csi.confidence.score),
    evidenceCount: csi.eventCount,
    calculatedAt: csi.calculatedAt,
  };
}

/**
 * Generate a risk explanation for any generic risk score (0–100)
 * from a set of events. Used by the event details panel.
 */
export function explainRiskScore(
  score: number,
  events: GlobalEvent[],
  label = "Risk Score",
): ScoreExplanation {
  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const highCount = events.filter((e) => e.severity === "high").length;
  const mediumCount = events.filter((e) => e.severity === "medium").length;
  const catCounts = new Map<string, number>();
  for (const e of events) catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);

  const bullets: ScoreBullet[] = [];
  if (criticalCount > 0) bullets.push({ label: `${criticalCount} critical-severity event${criticalCount > 1 ? "s" : ""}`, value: "critical", impact: "high" });
  if (highCount > 0) bullets.push({ label: `${highCount} high-severity event${highCount > 1 ? "s" : ""}`, value: "high", impact: "medium" });
  if (mediumCount > 0) bullets.push({ label: `${mediumCount} medium-severity event${mediumCount > 1 ? "s" : ""}`, value: "medium", impact: "low" });

  const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [cat, count] of topCats) {
    bullets.push({ label: `${count} ${cat} event${count > 1 ? "s" : ""}`, value: cat, impact: "low" });
  }

  const avgConf = events.length > 0
    ? Math.round(events.reduce((s, e) => s + e.confidence, 0) / events.length)
    : 50;

  return {
    score,
    scoreLabel: label,
    interpretation: `${score}/100 — Based on ${events.length} events across ${catCounts.size} categories.`,
    bullets,
    methodologyNote: "Risk score is a weighted blend of severity (55%), importance (30%), and confidence (15%) for each event.",
    confidence: avgConf,
    confidenceLabel: confidenceLabel(avgConf),
    evidenceCount: events.length,
    calculatedAt: new Date().toISOString(),
  };
}
