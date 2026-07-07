import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { computeSeverity, type SeverityInput } from "./severityScore";
import { computeConfidence } from "./confidenceScore";
import { computeImportance } from "./importanceScore";
import { computeRiskScore } from "./riskScore";

export { computeSeverity, SEVERITY_WEIGHT } from "./severityScore";
export * from "./confidenceScore";
export * from "./importanceScore";
export * from "./riskScore";

export interface ScoreEventOptions {
  severityHint?: SeverityInput;
}

/**
 * Fills in `severity` (unless already decided by the caller), `confidence`,
 * `importance` and `riskScore` for a partially-built GlobalEvent. Pure and
 * deterministic — safe to call repeatedly, never touches the network or AI.
 */
export function scoreEvent(event: GlobalEvent, options: ScoreEventOptions = {}): GlobalEvent {
  const severity = options.severityHint ? computeSeverity(options.severityHint) : event.severity;
  const confidence = computeConfidence({ provider: event.provider, status: event.status, verified: event.verified });
  const importance = computeImportance({
    severity,
    timestamp: event.timestamp,
    verified: event.verified,
    featured: event.featured,
    tagCount: event.tags.length,
  });
  const riskScore = computeRiskScore({ severity, importance, confidence });
  const featured = event.featured || riskScore >= 85;

  return { ...event, severity, confidence, importance, riskScore, featured };
}
