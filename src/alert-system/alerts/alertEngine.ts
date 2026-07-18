/**
 * Global Alert Engine
 *
 * The centralized engine that evaluates every normalized GlobalEvent and
 * decides whether it should contribute to an active alert.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PIPELINE
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Filter — discard events that are not alert-worthy (low severity AND
 *      low risk). This is the only "should we alert?" decision point.
 *   2. Group  — cluster alert-worthy events by (country, category) within a
 *      rolling 7-day window. Events sharing a country+category are treated
 *      as evidence for the SAME situation, not separate alerts.
 *   3. Score  — compute level, confidence, priority, and multi-source
 *      validation for each group (see alertScoring.ts).
 *   4. Stabilize — alert IDs are DETERMINISTIC (derived from the grouping
 *      key, not randomly generated), so the same real-world situation keeps
 *      the same alert ID across refreshes. This allows the history store to
 *      detect escalation / resolution over time instead of only "new" data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALERT-WORTHINESS RULE
 * ─────────────────────────────────────────────────────────────────────────
 *   An event qualifies for alerting when:
 *     severity !== "low"          (medium, high, critical), OR
 *     riskScore >= 55              (borderline-severe low-severity events)
 *
 * No alert is ever invented — every alert traces back to ≥1 real event.
 */
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type { GlobalAlert, AlertStatus } from "../types";
import { sourceTypeForCategory } from "../types";
import {
  computeAlertLevel,
  computeMultiSourceValidation,
  computeAlertConfidence,
  computeAlertPriority,
  computeAlertRiskScore,
  buildAlertExplanation,
} from "./alertScoring";
import { REGION_COUNTRIES } from "@/domain/decision/stability/stabilityEngine";
import { isIntelligenceSignal } from "@/domain/constants/metadataProviders";

const GROUP_WINDOW_MS = 7 * 86_400_000; // 7 days
const RESOLVE_AFTER_MS = 3 * 86_400_000; // no new evidence for 3 days → auto-resolve

// ─── Alert-worthiness ─────────────────────────────────────────────────────────

function isAlertWorthy(event: GlobalEvent): boolean {
  return event.severity !== "low" || event.riskScore >= 55;
}

// ─── Grouping key ─────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function groupKey(country: string | undefined, category: GlobalEventCategory): string {
  return `alert:${country ? slugify(country) : "global"}:${category}`;
}

// ─── Region lookup ────────────────────────────────────────────────────────────

function regionsForCountries(countries: string[]): string[] {
  const regions = new Set<string>();
  for (const country of countries) {
    for (const [region, list] of Object.entries(REGION_COUNTRIES)) {
      if (list.some((c) => c.toLowerCase() === country.toLowerCase())) regions.add(region);
    }
  }
  return [...regions];
}

// ─── Title builder ────────────────────────────────────────────────────────────

const CATEGORY_ALERT_LABELS: Partial<Record<GlobalEventCategory, string>> = {
  earthquake:  "Seismic Activity",
  military:    "Military & Conflict Activity",
  geopolitics: "Geopolitical Situation",
  disaster:    "Natural Disaster Activity",
  cyber:       "Cyber Threat Activity",
  economy:     "Economic Warning",
  health:      "Health Alert",
  weather:     "Severe Weather",
  climate:     "Climate Emergency",
  energy:      "Energy Disruption",
  technology:  "Technology Incident",
  general:     "Breaking Situation",
  country:     "Country Development",
};

function buildTitle(country: string | undefined, category: GlobalEventCategory, count: number): string {
  const label = CATEGORY_ALERT_LABELS[category] ?? "Situation";
  if (country) {
    return count > 1 ? `${label} — ${country} (${count} events)` : `${label} — ${country}`;
  }
  return `Global ${label}`;
}

function buildSummary(events: GlobalEvent[]): string {
  const top = [...events].sort((a, b) => b.riskScore - a.riskScore)[0];
  return top ? top.title : "Multiple related events detected.";
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate the current set of GlobalAlerts from a pool of GlobalEvents.
 * Pure function — no side effects, no caching (caller decides caching policy).
 */
export function generateAlerts(events: GlobalEvent[]): GlobalAlert[] {
  const now = Date.now();

  const worthy = events.filter((e) => {
    if (!isIntelligenceSignal(e)) return false;
    if (!isAlertWorthy(e)) return false;
    const age = now - new Date(e.timestamp).getTime();
    return age >= 0 && age <= GROUP_WINDOW_MS;
  });

  const groups = new Map<string, GlobalEvent[]>();
  for (const event of worthy) {
    const key = groupKey(event.country, event.category);
    const arr = groups.get(key) ?? [];
    arr.push(event);
    groups.set(key, arr);
  }

  const alerts: GlobalAlert[] = [];

  for (const [key, groupEvents] of groups) {
    const sorted = [...groupEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const level = computeAlertLevel(sorted);
    const multiSource = computeMultiSourceValidation(sorted);
    const confidence = computeAlertConfidence(sorted, multiSource.sourceCount);
    const priority = computeAlertPriority(sorted, level);
    const riskScore = computeAlertRiskScore(sorted);
    const explanation = buildAlertExplanation(sorted, level, multiSource);

    const countries = [...new Set(sorted.map((e) => e.country).filter(Boolean) as string[])];
    const regions = regionsForCountries(countries);

    const newestTimestamp = sorted[0].timestamp;
    const oldestTimestamp = sorted[sorted.length - 1].timestamp;

    const ageOfNewest = now - new Date(newestTimestamp).getTime();
    const status: AlertStatus = ageOfNewest > RESOLVE_AFTER_MS ? "resolved" : "active";

    const primaryCategory = sorted[0].category;
    const primaryCountry = countries[0];

    alerts.push({
      id: key,
      title: buildTitle(primaryCountry, primaryCategory, sorted.length),
      summary: buildSummary(sorted),

      level,
      status,
      sourceType: sourceTypeForCategory(primaryCategory),
      category: primaryCategory,

      severity: sorted[0].severity,
      confidence,
      priority,
      riskScore,

      providers: multiSource.providers,
      sourceCount: multiSource.sourceCount,
      multiSourceConfirmed: multiSource.multiSourceConfirmed,

      supportingEventIds: sorted.map((e) => e.id),
      affectedCountries: countries,
      affectedRegions: regions,

      explanation,

      firstSeenAt: oldestTimestamp,
      lastUpdatedAt: newestTimestamp,
      resolvedAt: status === "resolved" ? new Date(now).toISOString() : undefined,
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority);
}

// ─── Convenience filters ──────────────────────────────────────────────────────

export function getActiveAlerts(alerts: GlobalAlert[]): GlobalAlert[] {
  return alerts.filter((a) => a.status === "active" || a.status === "escalated");
}

export function getCriticalAlerts(alerts: GlobalAlert[]): GlobalAlert[] {
  return alerts.filter((a) => a.level === "critical" || a.level === "extreme");
}

export function getResolvedAlerts(alerts: GlobalAlert[]): GlobalAlert[] {
  return alerts.filter((a) => a.status === "resolved");
}

export function getAlertsForCountry(alerts: GlobalAlert[], country: string): GlobalAlert[] {
  const target = country.toLowerCase();
  return alerts.filter((a) => a.affectedCountries.some((c) => c.toLowerCase() === target));
}

export function getAlertsForRegion(alerts: GlobalAlert[], region: string): GlobalAlert[] {
  return alerts.filter((a) => a.affectedRegions.includes(region));
}
