import type { GlobalEventSeverity } from "@/domain/models/GlobalEvent";

export interface SeverityInput {
  /** Trust the upstream classifier when the provider already computed a severity (GNews, saved alerts). */
  baseSeverity?: GlobalEventSeverity | string | null;
  /** Earthquake magnitude, when known — overrides text/base classification. */
  magnitude?: number;
  /** Wind speed (m/s), used for weather severity. */
  windSpeedMs?: number;
  /** Free text fallback (title + description) when no structured signal is available. */
  text?: string;
}

const CRITICAL_RX = /\b(war|invasion|nuclear|missile|dead|killed|emergency|attack|massacre|fatal|tsunami)\b/i;
const HIGH_RX = /\b(crisis|warning|conflict|sanctions|cyberattack|explosion|flood|evacuat|airstrike)\b/i;
const MEDIUM_RX = /\b(protest|inflation|election|storm|outage|recall|strike|tension)\b/i;

function normalizeSeverityLabel(raw: string): GlobalEventSeverity | null {
  const x = raw.trim().toLowerCase();
  if (x === "critical" || x === "high" || x === "medium" || x === "low") return x;
  return null;
}

function severityFromMagnitude(m: number): GlobalEventSeverity {
  if (m >= 6) return "critical";
  if (m >= 5) return "high";
  if (m >= 4) return "medium";
  return "low";
}

function severityFromWind(ms: number): GlobalEventSeverity {
  if (ms >= 25) return "critical";
  if (ms >= 17) return "high";
  if (ms >= 10) return "medium";
  return "low";
}

function severityFromText(text: string): GlobalEventSeverity {
  if (CRITICAL_RX.test(text)) return "critical";
  if (HIGH_RX.test(text)) return "high";
  if (MEDIUM_RX.test(text)) return "medium";
  return "low";
}

/**
 * Deterministic severity classification. Priority order:
 * 1. Structured magnitude (earthquake)
 * 2. Structured wind speed (weather)
 * 3. Upstream-provided base severity (already normalized by a provider, e.g. GNews classifier)
 * 4. Keyword scan over free text
 * 5. "low" default
 */
export function computeSeverity(input: SeverityInput): GlobalEventSeverity {
  if (typeof input.magnitude === "number") return severityFromMagnitude(input.magnitude);
  if (typeof input.windSpeedMs === "number") return severityFromWind(input.windSpeedMs);
  if (input.baseSeverity) {
    const normalized = normalizeSeverityLabel(String(input.baseSeverity));
    if (normalized) return normalized;
  }
  if (input.text) return severityFromText(input.text);
  return "low";
}

export const SEVERITY_WEIGHT: Record<GlobalEventSeverity, number> = {
  critical: 95,
  high: 70,
  medium: 40,
  low: 15,
};
