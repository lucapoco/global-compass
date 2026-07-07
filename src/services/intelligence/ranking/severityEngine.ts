/**
 * Severity Engine — deterministic auto-classification.
 *
 * Scans text with a tiered keyword system. No AI, no manual assignment.
 * Returns one of: "critical" | "high" | "medium" | "low"
 */
import type { EventSeverity } from "../types";
import { SEVERITY_CRITICAL, SEVERITY_HIGH, SEVERITY_MEDIUM } from "../nlp/dictionaries";

/** Compile keyword lists into fast regex patterns at module load time. */
function buildPattern(words: string[]): RegExp {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("|"), "i");
}

const RX_CRITICAL = buildPattern(SEVERITY_CRITICAL);
const RX_HIGH = buildPattern(SEVERITY_HIGH);
const RX_MEDIUM = buildPattern(SEVERITY_MEDIUM);

/**
 * Classify severity from raw text (title + description).
 * Also accepts an optional magnitude for earthquakes.
 */
export function classifyEventSeverity(
  text: string,
  options?: { magnitude?: number },
): EventSeverity {
  // Earthquake magnitude overrides text-based severity
  if (options?.magnitude !== undefined) {
    if (options.magnitude >= 7) return "critical";
    if (options.magnitude >= 5.5) return "high";
    if (options.magnitude >= 4) return "medium";
    return "low";
  }

  if (RX_CRITICAL.test(text)) return "critical";
  if (RX_HIGH.test(text)) return "high";
  if (RX_MEDIUM.test(text)) return "medium";
  return "low";
}

/** Style metadata for severity badges. */
export const SEVERITY_META: Record<EventSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "CRITICAL", color: "text-rose-glow", bg: "bg-rose-glow/20", border: "border-rose-glow/40" },
  high:     { label: "HIGH",     color: "text-amber-glow", bg: "bg-amber-glow/15", border: "border-amber-glow/30" },
  medium:   { label: "MEDIUM",   color: "text-cyan-glow",  bg: "bg-cyan-glow/15",  border: "border-cyan-glow/30" },
  low:      { label: "LOW",      color: "text-emerald-glow", bg: "bg-emerald-glow/15", border: "border-emerald-glow/30" },
};

/** Numeric severity value for sorting (critical = 4, low = 1). */
export const SEVERITY_NUMERIC: Record<EventSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};
