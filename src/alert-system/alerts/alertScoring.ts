/**
 * Alert Scoring
 *
 * Computes level, confidence, priority, and multi-source validation for a
 * group of related GlobalEvents that together form one GlobalAlert.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALERT LEVEL ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 * Base level comes from the highest severity in the supporting event group
 * (see SEVERITY_TO_ALERT_LEVEL). It is then escalated by:
 *
 *   +1 level  if multi-source confirmed (≥2 distinct providers)
 *   +1 level  if ≥5 supporting events (large event cluster)
 *   +1 level  if affecting ≥3 countries
 *
 * Escalations are capped — an alert can rise at most 2 levels above its
 * severity baseline, and never past "extreme".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONFIDENCE ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 *   confidence = avg(event.confidence) × 0.5
 *              + sourceCountBonus       × 0.3   (1 source=0, 2=0.6, 3+=1.0)
 *              + verifiedBonus          × 0.2   (fraction of verified events)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PRIORITY ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 *   priority = riskScore × 0.5 + levelWeight × 0.3 + recency × 0.2
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MULTI-SOURCE VALIDATION EXAMPLES
 * ─────────────────────────────────────────────────────────────────────────
 *   News + USGS        → conflict/disaster confirmed by seismic authority
 *   News + NASA EONET   → disaster confirmed by satellite detection
 *   Weather + News      → extreme weather confirmed editorially
 *   ACLED + News        → conflict confirmed by both structured + editorial sources
 *   World Bank + News   → economic signal confirmed by institutional data
 */
import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import type { AlertLevel } from "../types";
import { ALERT_LEVEL_ORDER, SEVERITY_TO_ALERT_LEVEL } from "../types";

const SIX_HOURS_MS = 6 * 3_600_000;

// ─── Level escalation ─────────────────────────────────────────────────────────

export function computeAlertLevel(events: GlobalEvent[]): AlertLevel {
  const highestSeverity = events.reduce<GlobalEvent["severity"]>((worst, e) => {
    const order = { low: 0, medium: 1, high: 2, critical: 3 };
    return order[e.severity] > order[worst] ? e.severity : worst;
  }, "low");

  let levelIdx = ALERT_LEVEL_ORDER.indexOf(SEVERITY_TO_ALERT_LEVEL[highestSeverity]);
  let escalations = 0;

  const providers = new Set(events.map((e) => e.provider));
  const countries = new Set(events.map((e) => e.country).filter(Boolean));

  if (providers.size >= 2 && escalations < 2) { levelIdx++; escalations++; }
  if (events.length >= 5 && escalations < 2) { levelIdx++; escalations++; }
  if (countries.size >= 3 && escalations < 2) { levelIdx++; escalations++; }

  levelIdx = Math.min(levelIdx, ALERT_LEVEL_ORDER.length - 1);
  return ALERT_LEVEL_ORDER[levelIdx];
}

// ─── Multi-source validation ─────────────────────────────────────────────────

export interface MultiSourceResult {
  providers: GlobalEventProvider[];
  sourceCount: number;
  multiSourceConfirmed: boolean;
  explanation: string;
}

const PROVIDER_LABELS: Record<GlobalEventProvider, string> = {
  gnews: "News", usgs: "USGS", openweather: "Weather", rest_countries: "Country Data",
  supabase_alerts: "Saved Alerts", supabase_intelligence: "Saved Intel",
  nasa_eonet: "NASA EONET", acled: "ACLED Conflict Data", world_bank: "World Bank",
  gdacs: "GDACS", reliefweb: "ReliefWeb", gdelt: "GDELT", rss: "News RSS",
  nasa_firms: "NASA FIRMS", internal: "Internal",
};

export function computeMultiSourceValidation(events: GlobalEvent[]): MultiSourceResult {
  const providers = [...new Set(events.map((e) => e.provider))];
  const sourceCount = providers.length;
  const multiSourceConfirmed = sourceCount >= 2;

  const explanation = multiSourceConfirmed
    ? `Confirmed by ${sourceCount} independent sources: ${providers.map((p) => PROVIDER_LABELS[p]).join(" + ")}.`
    : `Reported by a single source: ${PROVIDER_LABELS[providers[0]] ?? providers[0]}.`;

  return { providers, sourceCount, multiSourceConfirmed, explanation };
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export function computeAlertConfidence(events: GlobalEvent[], sourceCount: number): number {
  if (events.length === 0) return 0;

  const avgConfidence = events.reduce((s, e) => s + e.confidence, 0) / events.length;
  const sourceBonus = sourceCount >= 3 ? 1 : sourceCount === 2 ? 0.6 : 0;
  const verifiedFraction = events.filter((e) => e.verified).length / events.length;

  const raw = (avgConfidence / 100) * 0.5 + sourceBonus * 0.3 + verifiedFraction * 0.2;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

// ─── Priority ─────────────────────────────────────────────────────────────────

export function computeAlertPriority(events: GlobalEvent[], level: AlertLevel): number {
  if (events.length === 0) return 0;

  const avgRisk = events.reduce((s, e) => s + e.riskScore, 0) / events.length;
  const levelWeight = (ALERT_LEVEL_ORDER.indexOf(level) / (ALERT_LEVEL_ORDER.length - 1)) * 100;

  const now = Date.now();
  const avgAge = events.reduce((s, e) => s + (now - new Date(e.timestamp).getTime()), 0) / events.length;
  const recency = Math.max(0, 100 - (avgAge / SIX_HOURS_MS) * 100);

  const priority = avgRisk * 0.5 + levelWeight * 0.3 + recency * 0.2;
  return Math.round(Math.min(100, Math.max(0, priority)));
}

// ─── Risk score (aggregate) ───────────────────────────────────────────────────

export function computeAlertRiskScore(events: GlobalEvent[]): number {
  if (events.length === 0) return 0;
  return Math.round(events.reduce((s, e) => s + e.riskScore, 0) / events.length);
}

// ─── Explanation builder ──────────────────────────────────────────────────────

export function buildAlertExplanation(
  events: GlobalEvent[],
  level: AlertLevel,
  multiSource: MultiSourceResult,
): string {
  const countries = [...new Set(events.map((e) => e.country).filter(Boolean))];
  const parts: string[] = [];

  parts.push(`${events.length} supporting event${events.length > 1 ? "s" : ""} detected.`);
  if (countries.length > 0) {
    parts.push(`Affecting ${countries.length} countr${countries.length > 1 ? "ies" : "y"}: ${countries.slice(0, 3).join(", ")}${countries.length > 3 ? "…" : ""}.`);
  }
  parts.push(multiSource.explanation);
  parts.push(`Alert level "${level}" reflects severity, cross-source confirmation, and geographic spread.`);

  return parts.join(" ");
}
