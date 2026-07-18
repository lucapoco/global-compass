/**
 * Correlation Explainability Engine
 *
 * Transforms a list of matching StrategyResults into a structured,
 * human-readable explanation that the UI can display.
 *
 * Output example:
 * ─────────────────────────────────────────────────────────────────
 * "These events are connected because:
 *  • Same country (Japan)
 *  • Published 4 hours apart
 *  • Earthquakes frequently trigger secondary disasters
 *  • Overlapping keywords (earthquake, infrastructure, Japan)
 *
 *  Confidence: 87%  ·  Strength: High  ·  2 providers"
 * ─────────────────────────────────────────────────────────────────
 *
 * Design principle: every correlation edge MUST have an explanation.
 * An unexplained correlation is never surfaced to the user.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { StrategyResult, CorrelationEdge, CorrelationFactor } from "./types";

// ─── Strength label ────────────────────────────────────────────────────────────

export type StrengthLabel = "Very High" | "High" | "Moderate" | "Low";

export function strengthLabel(strength: number): StrengthLabel {
  if (strength >= 80) return "Very High";
  if (strength >= 60) return "High";
  if (strength >= 40) return "Moderate";
  return "Low";
}

// ─── Confidence calculation ───────────────────────────────────────────────────

/**
 * Weighted average of matching strategy scores.
 *
 * Algorithm:
 *   confidence = Σ(score × weight) / Σ(weight)  for matched strategies
 *
 * An edge with only one matching strategy gets that strategy's score
 * directly weighted by its defined weight.
 */
export function computeConfidence(results: StrategyResult[]): number {
  if (!results.length) return 0;
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const weightedSum = results.reduce((s, r) => s + r.score * r.weight, 0);
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Strength score (0–100):
 *   Number of distinct relationship types × their average score.
 *   Rewarded for breadth (many strategies) AND depth (high individual scores).
 */
export function computeStrength(results: StrategyResult[]): number {
  if (!results.length) return 0;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const diversityBonus = Math.min(results.length * 10, 40);
  return Math.round(Math.min(100, avgScore * 0.6 + diversityBonus));
}

/**
 * Priority score (0–100):
 *   High-severity events in high-confidence edges surface first.
 *   Includes a recency bonus (more recent = higher priority).
 */
export function computePriority(
  confidence: number,
  strength: number,
  a: GlobalEvent,
  b: GlobalEvent,
): number {
  const severityScore = {
    critical: 100,
    high: 70,
    medium: 40,
    low: 15,
  };
  const maxSeverity = Math.max(
    severityScore[a.severity],
    severityScore[b.severity],
  );
  const raw = confidence * 0.5 + strength * 0.3 + maxSeverity * 0.2;
  return Math.round(Math.min(100, raw));
}

// ─── Text generation ───────────────────────────────────────────────────────────

function formatConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/**
 * Builds the full human-readable explanation string for a correlation edge.
 *
 * Format:
 *   "These events are connected because:\n
 *    • [reason 1]\n
 *    • [reason 2]\n
 *    ...\n
 *    Confidence: XX%  ·  Strength: [label]"
 */
export function buildExplanation(
  results: StrategyResult[],
  confidence: number,
  strength: number,
  a: GlobalEvent,
  b: GlobalEvent,
): string {
  if (!results.length) {
    return `Weak statistical correlation between "${a.title.slice(0, 60)}" and "${b.title.slice(0, 60)}" — no strong individual signals.`;
  }

  const bullets = results.map((r) => `• ${r.reason}`).join("\n");
  const strengthStr = strengthLabel(strength);
  const providerNote =
    a.provider !== b.provider
      ? `  ·  Cross-provider (${a.provider} + ${b.provider})`
      : "";

  return `These events are connected because:\n${bullets}\n\nConfidence: ${confidence}%  ${formatConfidenceBar(confidence)}  ·  Strength: ${strengthStr}${providerNote}`;
}

// ─── Edge assembler ───────────────────────────────────────────────────────────

/**
 * Combines all strategy results for an event pair into a complete
 * `CorrelationEdge` with scores, explanation, and metadata.
 */
export function assembleEdge(
  a: GlobalEvent,
  b: GlobalEvent,
  results: StrategyResult[],
  distanceKm: number | null,
): Omit<CorrelationEdge, "id"> {
  const confidence = computeConfidence(results);
  const strength = computeStrength(results);
  const priority = computePriority(confidence, strength, a, b);
  const explanation = buildExplanation(results, confidence, strength, a, b);

  const timeDiffMs = Math.abs(
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const factors: CorrelationFactor[] = results.map((r) => ({
    relationship: r.relationship,
    score: r.score,
    reason: r.reason,
  }));

  // Temporal direction: earlier event = source
  const tA = new Date(a.timestamp).getTime();
  const tB = new Date(b.timestamp).getTime();
  const [sourceId, targetId] = tA <= tB ? [a.id, b.id] : [b.id, a.id];

  return {
    sourceId,
    targetId,
    relationships: [...new Set(results.map((r) => r.relationship))],
    confidence,
    strength,
    priority,
    timeDifferenceMs: timeDiffMs,
    distanceKm,
    explanation,
    factors,
  };
}
