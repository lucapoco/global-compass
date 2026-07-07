import type { GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { SEVERITY_WEIGHT } from "./severityScore";
import { ageMs } from "@/domain/utils/time";

export interface ImportanceInput {
  severity: GlobalEventSeverity;
  timestamp: string;
  verified?: boolean;
  featured?: boolean;
  tagCount?: number;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic importance score (0-100): how newsworthy/urgent an event is,
 * independent of how much we trust the source. Recent + severe + verified events rank highest.
 */
export function computeImportance(input: ImportanceInput): number {
  let score = SEVERITY_WEIGHT[input.severity];

  const age = ageMs(input.timestamp);
  if (age <= SIX_HOURS_MS) score += 12;
  else if (age <= ONE_DAY_MS) score += 6;

  if (input.verified) score += 5;
  if (input.featured) score += 8;
  if ((input.tagCount ?? 0) >= 3) score += 3;

  return Math.round(Math.min(100, Math.max(0, score)));
}
