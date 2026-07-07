import type { GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { SEVERITY_WEIGHT } from "./severityScore";

export interface RiskInput {
  severity: GlobalEventSeverity;
  importance: number;
  confidence: number;
}

/**
 * Deterministic composite risk score (0-100). Weighted blend of severity, importance
 * and confidence — low-confidence data dampens the final risk so demo/cached items
 * never outrank verified live signals of the same severity.
 */
export function computeRiskScore(input: RiskInput): number {
  const severityBase = SEVERITY_WEIGHT[input.severity];
  const raw = severityBase * 0.55 + input.importance * 0.3 + input.confidence * 0.15;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
