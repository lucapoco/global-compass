/**
 * Change Detection Engine
 *
 * Answers the question "what changed?" by comparing the current event pool
 * against a time-windowed baseline.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────────────────────
 * The detector does NOT use snapshots — it uses the event timestamps already
 * embedded in GlobalEvent objects.  "New" events are those published within
 * the chosen window.  "Baseline" risk is computed from events BEFORE the window.
 *
 * For "what changed today": window = [midnight today, now]
 * For "last 24h":           window = [now−24h, now]
 * For "this week":          window = [now−7d, now]
 *
 * NO predictions. NO fabricated data.
 * All comparisons are within the real event pool.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { PlatformChangeSummary, ChangeWindowId } from "../models/ReportModel";
import { computeGlobalStabilityIndex } from "../stability/stabilityEngine";
import { REGION_COUNTRIES } from "../stability/stabilityEngine";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// ─── Window resolution ────────────────────────────────────────────────────────

function resolveWindow(windowId: ChangeWindowId, now: number): { fromMs: number; toMs: number; label: string } {
  if (windowId === "today") {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return { fromMs: midnight.getTime(), toMs: now, label: "today" };
  }
  if (windowId === "24h") {
    return { fromMs: now - 24 * HOUR, toMs: now, label: "last 24 hours" };
  }
  return { fromMs: now - 7 * DAY, toMs: now, label: "last 7 days" };
}

// ─── Region assignment ────────────────────────────────────────────────────────

function regionForCountry(country: string): string | null {
  for (const [region, countries] of Object.entries(REGION_COUNTRIES)) {
    if (countries.some((c) => c.toLowerCase() === country.toLowerCase())) return region;
  }
  return null;
}

// ─── Most active regions ──────────────────────────────────────────────────────

function computeMostActiveRegions(
  newEvents: GlobalEvent[],
): Array<{ region: string; eventCount: number }> {
  const regionCounts = new Map<string, number>();
  for (const e of newEvents) {
    if (!e.country) continue;
    const region = regionForCountry(e.country) ?? "Other";
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }
  return [...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([region, eventCount]) => ({ region, eventCount }));
}

// ─── Emerging countries ───────────────────────────────────────────────────────

function computeEmergingCountries(newEvents: GlobalEvent[]): string[] {
  const countryCounts = new Map<string, number>();
  for (const e of newEvents) {
    if (!e.country) continue;
    countryCounts.set(e.country, (countryCounts.get(e.country) ?? 0) + 1);
  }
  return [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country]) => country);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute what changed within the specified window.
 *
 * @param events   All GlobalEvents (the full current pool)
 * @param windowId Which change window to analyze
 */
export function detectChanges(
  events: GlobalEvent[],
  windowId: ChangeWindowId = "24h",
): PlatformChangeSummary {
  const now = Date.now();
  const { fromMs, toMs, label } = resolveWindow(windowId, now);

  // New events: published within the window
  const newEvents = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t >= fromMs && t <= toMs;
  });

  // Baseline events: everything before the window
  const baselineEvents = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t < fromMs;
  });

  // Risk comparison
  const currentGSI = computeGlobalStabilityIndex(events);
  const baselineGSI = baselineEvents.length > 0
    ? computeGlobalStabilityIndex(baselineEvents)
    : null;

  const stabilityDelta = baselineGSI ? currentGSI.score - baselineGSI.score : 0;
  const riskDelta = -stabilityDelta;  // inverse: stability up = risk down

  // Category counts in new events
  const catCounts = new Map<string, number>();
  for (const e of newEvents) {
    catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
  }
  const topNewCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category: category as GlobalEvent["category"], count }));

  return {
    windowId,
    windowLabel: label,
    newEvents: newEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    newEventCount: newEvents.length,
    riskDelta,
    stabilityDelta,
    mostActiveRegions: computeMostActiveRegions(newEvents),
    topNewCategories,
    emergingCountries: computeEmergingCountries(newEvents),
    calculatedAt: new Date().toISOString(),
  };
}
