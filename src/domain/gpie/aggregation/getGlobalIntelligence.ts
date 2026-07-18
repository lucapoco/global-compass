/**
 * getGlobalIntelligence
 *
 * Unified aggregation service for platform-wide intelligence snapshots.
 *
 * Returns all events from every active provider, already:
 *   • normalised (each provider maps to GlobalEvent)
 *   • deduplicated (cross-provider title similarity)
 *   • scored (severity / importance / confidence / riskScore)
 *   • correlated (relatedEvents links populated)
 *   • sorted (most recent first)
 *
 * This is the ONLY function the dashboard, globe, and analytics pages
 * should call for bulk data.  Per-country pages use getCountryIntelligence().
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type { GlobalIntelligenceSnapshot } from "../models/CountryIntelligence";
import { isIntelligenceSignal } from "@/domain/constants/metadataProviders";

/* ── Top risk countries ─────────────────────────────────────────────────── */

const SEVERITY_POINTS: Record<string, number> = {
  critical: 20,
  high: 8,
  medium: 3,
  low: 1,
};

function computeTopRiskCountries(
  events: GlobalEvent[],
  topN = 5,
): GlobalIntelligenceSnapshot["topRiskCountries"] {
  const countryMap = new Map<string, { score: number; eventCount: number }>();

  for (const event of events) {
    if (!isIntelligenceSignal(event)) continue;
    if (!event.country) continue;
    const pts = SEVERITY_POINTS[event.severity] ?? 1;
    const existing = countryMap.get(event.country) ?? { score: 0, eventCount: 0 };
    countryMap.set(event.country, {
      score: existing.score + pts,
      eventCount: existing.eventCount + 1,
    });
  }

  return Array.from(countryMap.entries())
    .map(([country, stats]) => ({ country, ...stats }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/* ── Category grouping ──────────────────────────────────────────────────── */

function groupByCategory(
  events: GlobalEvent[],
): Partial<Record<GlobalEventCategory, GlobalEvent[]>> {
  const result: Partial<Record<GlobalEventCategory, GlobalEvent[]>> = {};
  for (const event of events) {
    const group = result[event.category] ?? [];
    group.push(event);
    result[event.category] = group;
  }
  // Sort each category by riskScore descending
  for (const cat in result) {
    result[cat as GlobalEventCategory]!.sort((a, b) => b.riskScore - a.riskScore);
  }
  return result;
}

/* ── Options ────────────────────────────────────────────────────────────── */

export interface GetGlobalIntelligenceOptions {
  /** Bypass all provider caches (default false). */
  force?: boolean;
  /** Restrict to specific provider IDs (default: all). */
  providerIds?: GlobalEvent["provider"][];
  /** Maximum events to return (default: unlimited). */
  limit?: number;
}

/* ── Pure builder (shared with IntelligenceStore) ──────────────────────── */

/**
 * Pure, synchronous snapshot assembly — takes an already-loaded event list
 * (e.g. from a shared cache) and never calls the EventEngine itself. Exported
 * so `IntelligenceStore` (the app-wide single source of truth) can reuse this
 * exact aggregation logic against its own shared event cache instead of
 * triggering a second independent `eventEngine.loadAll()`.
 */
export function assembleGlobalIntelligenceSnapshot(
  events: GlobalEvent[],
): GlobalIntelligenceSnapshot {
  const totals = {
    total: events.length,
    critical: events.filter((e) => e.severity === "critical").length,
    high: events.filter((e) => e.severity === "high").length,
    live: events.filter((e) => e.live).length,
  };

  return {
    events,
    totals,
    byCategory: groupByCategory(events),
    topRiskCountries: computeTopRiskCountries(events),
    providerStatus: eventEngine.getProviderStatus(),
    lastUpdated: new Date().toISOString(),
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Load and assemble a full platform intelligence snapshot.
 *
 * Delegates to EventEngine which handles provider orchestration, caching,
 * deduplication, scoring, and correlation.  This function adds the
 * aggregation layer (category grouping, top-risk countries, statistics).
 */
export async function getGlobalIntelligence(
  options: GetGlobalIntelligenceOptions = {},
): Promise<GlobalIntelligenceSnapshot> {
  const allEvents = await eventEngine.loadAll({
    force: options.force,
    providerIds: options.providerIds,
  });

  const events = options.limit ? allEvents.slice(0, options.limit) : allEvents;
  return assembleGlobalIntelligenceSnapshot(events);
}

/**
 * Lightweight variant — returns only the totals without grouping.
 * Used by the dashboard header KPIs when a full snapshot is too expensive.
 */
export async function getGlobalIntelligenceSummary(): Promise<
  Pick<GlobalIntelligenceSnapshot, "totals" | "lastUpdated" | "providerStatus">
> {
  const events = eventEngine.getLastLoaded();

  if (!events.length) {
    // Nothing loaded yet — trigger a quiet load without force-refreshing
    await eventEngine.loadAll({ correlate: false });
  }

  const loaded = eventEngine.getLastLoaded();

  return {
    totals: {
      total: loaded.length,
      critical: loaded.filter((e) => e.severity === "critical").length,
      high: loaded.filter((e) => e.severity === "high").length,
      live: loaded.filter((e) => e.live).length,
    },
    providerStatus: eventEngine.getProviderStatus(),
    lastUpdated: new Date().toISOString(),
  };
}
