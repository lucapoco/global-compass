/**
 * Intelligence Store — Unified Single Source of Truth
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The Global Pulse Intelligence Engine (GPIE) already aggregates and
 * normalises every provider (GNews, USGS, OpenWeather, REST Countries,
 * GDACS, ReliefWeb, GDELT, RSS, NASA FIRMS, ACLED, World Bank, Supabase...)
 * into `GlobalEvent[]` via the `eventEngine` singleton, and several rich
 * derived engines already exist on top of it (Decision Support, Knowledge
 * Graph, Correlation/Timeline). Mission Control, the Alert Center, and the
 * World Map already consume this stack.
 *
 * Every OTHER page (Dashboard, Intelligence Feed, Analytics, AI Assistant,
 * Country pages, Reports, ...) instead called narrow, provider-specific
 * legacy services (`newsApi` → GNews only, `earthquakesApi` → USGS only,
 * `countriesApi`, `riskService`) directly and independently — meaning most
 * of the platform never saw GDACS, ReliefWeb, GDELT, RSS, ACLED, or
 * World Bank data at all, and every page paid its own network + compute cost.
 *
 * This module is the single facade every page should import from. It:
 *   1. Owns ONE shared, short-TTL cache of the fully processed
 *      (deduplicated → scored → correlated) `GlobalEvent[]` list, with
 *      in-flight request coalescing, so concurrent callers never trigger
 *      redundant `eventEngine.loadAll()` runs (avoids duplicate provider
 *      network requests AND redundant O(n²) correlation recomputation).
 *   2. Exposes every derived computation (stability, analytics, summaries,
 *      knowledge graph, timeline, trending topics, country/regional
 *      profiles) as a simple `getX()` method — all reusing the SAME shared
 *      event list, and all delegating to the existing, already-audited
 *      pure engines rather than re-implementing scoring/aggregation logic.
 *
 * No page should ever call `newsApi`, `earthquakesApi`, `countriesApi`, or
 * `riskService` directly again — every provider-derived need routes
 * through this store.
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import { filterEvents, type EventFilterOptions } from "@/domain/services/event-engine/filters/eventFilters";
import { searchEvents } from "@/domain/services/event-engine/search/searchEvents";
import type { ProviderStatusSnapshot } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";

import {
  assembleGlobalIntelligenceSnapshot,
} from "@/domain/gpie/aggregation/getGlobalIntelligence";
import {
  assembleCountryIntelligenceProfile,
  type GetCountryIntelligenceOptions,
} from "@/domain/gpie/aggregation/getCountryIntelligence";
import { getWorldBankData } from "@/domain/gpie/providers/worldBankProvider";
import type { GlobalIntelligenceSnapshot, CountryIntelligenceProfile } from "@/domain/gpie/models/CountryIntelligence";

import {
  computeGlobalStabilityIndex,
  computeCountryStabilityIndex,
  computeRegionalStabilityIndex,
  REGION_COUNTRIES,
  buildAnalyticsSummary,
  computeTopRiskCountries,
  buildExecutiveSummary,
  buildGlobalSummary,
  buildCountrySummary,
  buildRegionalSummary,
  buildDailyBriefing,
  buildWeeklyBriefing,
  buildEmergencyBriefing,
  detectEmergingRisks,
  detectChanges,
} from "@/domain/decision";
import type {
  GlobalStabilityIndex,
  CountryStabilityIndex,
  AnalyticsSummary,
  TopRiskCountry,
  EmergingRisk,
  PlatformChangeSummary,
  ChangeWindowId,
  IntelligenceSummary,
  SummaryType,
} from "@/domain/decision";

import { getGlobalEventGraph } from "@/domain/engine";
import type { TimelineGroup, IntelligenceGraph } from "@/domain/engine";

import { generateGraph, generateCountryGraph } from "@/knowledge-graph/engine/graphEngine";
import type { KnowledgeGraph } from "@/knowledge-graph/types";

import type { DashboardIntelligenceData, RegionalIntelligenceProfile, TrendingTopic } from "./types";
import { filterIntelligenceSignals } from "@/domain/constants/metadataProviders";

// ─────────────────────────────────────────────────────────────────────────
// Shared event cache — the single load point for the whole app
// ─────────────────────────────────────────────────────────────────────────

const EVENTS_TTL_MS = 90_000; // 90s: fresh enough for interactive UI, far below any provider TTL

let cachedEvents: GlobalEvent[] | null = null;
let cachedAt = 0;
let inFlight: Promise<GlobalEvent[]> | null = null;

async function loadSharedEvents(force = false): Promise<GlobalEvent[]> {
  const isFresh = cachedEvents !== null && Date.now() - cachedAt < EVENTS_TTL_MS;
  if (!force && isFresh) return cachedEvents!;
  if (inFlight) return inFlight;

  inFlight = eventEngine
    .loadAll({ force })
    .then((events) => {
      cachedEvents = events;
      cachedAt = Date.now();
      inFlight = null;
      return events;
    })
    .catch((e) => {
      inFlight = null;
      if (cachedEvents) return cachedEvents; // degrade to last-known-good rather than break the UI
      throw e;
    });

  return inFlight;
}

/** Force-clears the shared event cache — call after a user save/delete action. */
export function invalidateIntelligenceStore(): void {
  cachedEvents = null;
  cachedAt = 0;
}

/** Cache introspection, for debug/health panels. */
export function getIntelligenceStoreStats(): { cached: boolean; ageMs: number | null; eventCount: number } {
  return {
    cached: cachedEvents !== null,
    ageMs: cachedEvents ? Date.now() - cachedAt : null,
    eventCount: cachedEvents?.length ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. getLatestEvents — the base primitive every other getter builds on
// ─────────────────────────────────────────────────────────────────────────

export interface GetLatestEventsOptions {
  force?: boolean;
  limit?: number;
  filters?: EventFilterOptions;
  /** Free-text search, applied after filters. */
  query?: string;
}

export async function getLatestEvents(options: GetLatestEventsOptions = {}): Promise<GlobalEvent[]> {
  let events = await loadSharedEvents(options.force);
  if (options.filters) events = filterEvents(events, options.filters);
  if (options.query?.trim()) events = searchEvents(events, options.query);
  return options.limit ? events.slice(0, options.limit) : events;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. getGlobalIntelligence — full platform snapshot
// ─────────────────────────────────────────────────────────────────────────

export interface GetGlobalIntelligenceOptions {
  force?: boolean;
  limit?: number;
}

export async function getGlobalIntelligence(
  options: GetGlobalIntelligenceOptions = {},
): Promise<GlobalIntelligenceSnapshot> {
  const all = await loadSharedEvents(options.force);
  const events = options.limit ? all.slice(0, options.limit) : all;
  return assembleGlobalIntelligenceSnapshot(events);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. getTrendingTopics — keyword/tag frequency over a recent window
// ─────────────────────────────────────────────────────────────────────────

export interface GetTrendingTopicsOptions {
  force?: boolean;
  limit?: number;
  /** Recency window in ms — defaults to 48h. */
  windowMs?: number;
}

export async function getTrendingTopics(
  options: GetTrendingTopicsOptions = {},
): Promise<TrendingTopic[]> {
  const events = await loadSharedEvents(options.force);
  const windowMs = options.windowMs ?? 48 * 3_600_000;
  const recent = filterEvents(events, { sinceMs: windowMs });
  const pool = recent.length >= 8 ? recent : events; // fall back to full set when the window is too sparse

  const topics = new Map<
    string,
    { count: number; riskSum: number; categories: Set<GlobalEventCategory>; ids: string[] }
  >();

  for (const event of pool) {
    for (const rawTag of event.tags) {
      const tag = rawTag.toLowerCase().trim();
      if (tag.length < 3) continue;
      const entry = topics.get(tag) ?? { count: 0, riskSum: 0, categories: new Set(), ids: [] };
      entry.count += 1;
      entry.riskSum += event.riskScore;
      entry.categories.add(event.category);
      if (entry.ids.length < 5) entry.ids.push(event.id);
      topics.set(tag, entry);
    }
  }

  return [...topics.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([topic, v]) => ({
      topic,
      count: v.count,
      avgRisk: Math.round(v.riskSum / v.count),
      categories: [...v.categories],
      sampleEventIds: v.ids,
    }))
    .sort((a, b) => b.count - a.count || b.avgRisk - a.avgRisk)
    .slice(0, options.limit ?? 12);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. getCountryIntelligence — per-country profile (events + risk + WB data)
// ─────────────────────────────────────────────────────────────────────────

export async function getCountryIntelligence(
  countryName: string,
  countryCode?: string,
  options: GetCountryIntelligenceOptions = {},
): Promise<CountryIntelligenceProfile> {
  const [events, worldBankData] = await Promise.all([
    loadSharedEvents(options.force),
    countryCode && !options.skipWorldBank ? getWorldBankData(countryCode).catch(() => null) : Promise.resolve(null),
  ]);

  return assembleCountryIntelligenceProfile(events, countryName, countryCode, worldBankData);
}

/** Country Stability Index (factor breakdown + confidence) for one country. */
export async function getCountryStabilityIndex(
  countryName: string,
  options: { force?: boolean } = {},
): Promise<CountryStabilityIndex> {
  const events = await loadSharedEvents(options.force);
  return computeCountryStabilityIndex(events, countryName);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. getRegionalIntelligence — per-region profile
// ─────────────────────────────────────────────────────────────────────────

export async function getRegionalIntelligence(
  region: string,
  options: { force?: boolean } = {},
): Promise<RegionalIntelligenceProfile> {
  const events = await loadSharedEvents(options.force);
  const rsi = computeRegionalStabilityIndex(events);
  const stability = rsi.entries.find((e) => e.region.toLowerCase() === region.toLowerCase()) ?? null;

  const countries = REGION_COUNTRIES[region] ?? stability?.countries ?? [];
  const lowerCountries = new Set(countries.map((c) => c.toLowerCase()));
  const regionEvents = events.filter((e) => e.country && lowerCountries.has(e.country.toLowerCase()));

  return {
    region,
    stability,
    events: regionEvents,
    topRiskCountries: computeTopRiskCountries(regionEvents, 10),
    lastUpdated: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 6/7. Highest-risk countries / events
// ─────────────────────────────────────────────────────────────────────────

export async function getHighestRiskCountries(
  topN = 10,
  options: { force?: boolean } = {},
): Promise<TopRiskCountry[]> {
  const events = filterIntelligenceSignals(await loadSharedEvents(options.force));
  return computeTopRiskCountries(events, topN);
}

export async function getHighestRiskEvents(
  limit = 10,
  options: { force?: boolean } = {},
): Promise<GlobalEvent[]> {
  const events = filterIntelligenceSignals(await loadSharedEvents(options.force));
  return [...events].sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. getAnalytics — full analytics dashboard bundle
// ─────────────────────────────────────────────────────────────────────────

export async function getAnalytics(options: { force?: boolean } = {}): Promise<AnalyticsSummary> {
  const events = await loadSharedEvents(options.force);
  return buildAnalyticsSummary(events);
}

// ─────────────────────────────────────────────────────────────────────────
// 9. getTimeline — chronological, correlated, clustered event stream
// ─────────────────────────────────────────────────────────────────────────

export async function getTimeline(
  windowId: "24h" | "7d" | "30d" = "7d",
  options: { force?: boolean } = {},
): Promise<TimelineGroup[]> {
  // Delegates to the Correlation Engine's graph service, which owns its own
  // 5-minute cache for the expensive correlate → cluster → timeline pipeline
  // (kept separate from the 90s event cache since it's a heavier, less
  // volatile computation shared with Knowledge Graph / country networks).
  const graph = await getGlobalEventGraph({ force: options.force, timelineWindow: windowId });
  return graph.timeline;
}

/** Full intelligence graph (nodes/edges/clusters/timeline) from the Correlation Engine. */
export async function getIntelligenceGraph(
  options: { force?: boolean; timelineWindow?: "24h" | "7d" | "30d" } = {},
): Promise<IntelligenceGraph> {
  return getGlobalEventGraph(options);
}

// ─────────────────────────────────────────────────────────────────────────
// 10. getKnowledgeGraph — entity/relationship graph for the Knowledge Graph page
// ─────────────────────────────────────────────────────────────────────────

export async function getKnowledgeGraph(
  options: { force?: boolean; maxEvents?: number } = {},
): Promise<KnowledgeGraph> {
  const events = await loadSharedEvents(options.force);
  return generateGraph(events, { maxEvents: options.maxEvents });
}

export async function getCountryKnowledgeGraph(
  countryName: string,
  options: { force?: boolean } = {},
): Promise<KnowledgeGraph> {
  const events = await loadSharedEvents(options.force);
  return generateCountryGraph(events, countryName);
}

// ─────────────────────────────────────────────────────────────────────────
// 11. getDashboardData — everything the dashboard needs, one shared load
// ─────────────────────────────────────────────────────────────────────────

export async function getDashboardData(
  options: { force?: boolean } = {},
): Promise<DashboardIntelligenceData> {
  const events = await loadSharedEvents(options.force);
  const signals = filterIntelligenceSignals(events);

  const gsi = computeGlobalStabilityIndex(signals);
  const summary = buildExecutiveSummary(signals, gsi);
  const analytics = buildAnalyticsSummary(events);
  const emergingRisks = detectEmergingRisks(signals).slice(0, 5);

  const critical = signals.filter((e) => e.severity === "critical").sort((a, b) => b.riskScore - a.riskScore);
  const DAY_MS = 24 * 3_600_000;
  const recentEvents = filterEvents(signals, { sinceMs: DAY_MS });

  return {
    events: signals.slice(0, 60),
    totals: {
      total: signals.length,
      critical: critical.length,
      high: signals.filter((e) => e.severity === "high").length,
      live: signals.filter((e) => e.live).length,
    },
    gsi,
    summary,
    analytics,
    criticalEvents: critical.slice(0, 20),
    recentEvents,
    topRiskCountries: analytics.topRiskCountries,
    emergingRisks,
    providerStatus: eventEngine.getProviderStatus(),
    lastUpdated: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Extras — global stability, summaries, change detection (used by AI/Reports)
// ─────────────────────────────────────────────────────────────────────────

export async function getGlobalStabilityIndex(
  options: { force?: boolean } = {},
): Promise<GlobalStabilityIndex> {
  const events = await loadSharedEvents(options.force);
  return computeGlobalStabilityIndex(events);
}

export async function getIntelligenceSummary(
  type: SummaryType,
  subject?: string,
  options: { force?: boolean } = {},
): Promise<IntelligenceSummary> {
  const events = await loadSharedEvents(options.force);
  switch (type) {
    case "global": return buildGlobalSummary(events);
    case "country": return buildCountrySummary(events, subject ?? "Unknown");
    case "regional": return buildRegionalSummary(events, subject ?? "Europe");
    case "daily_briefing": return buildDailyBriefing(events);
    case "weekly_briefing": return buildWeeklyBriefing(events);
    case "emergency": return buildEmergencyBriefing(events);
    case "executive":
    default:
      return buildExecutiveSummary(events);
  }
}

export async function getChanges(
  windowId: ChangeWindowId = "24h",
  options: { force?: boolean } = {},
): Promise<PlatformChangeSummary> {
  const events = await loadSharedEvents(options.force);
  return detectChanges(events, windowId);
}

export async function getEmergingRisks(options: { force?: boolean } = {}): Promise<EmergingRisk[]> {
  const events = await loadSharedEvents(options.force);
  return detectEmergingRisks(events);
}

/** Provider health/status snapshot — for API health panels. */
export function getProviderStatus(): ProviderStatusSnapshot[] {
  return eventEngine.getProviderStatus();
}

/** Related events for a given event id, resolved against the shared cache. */
export async function getRelatedEvents(
  eventId: string,
  options: { force?: boolean } = {},
): Promise<GlobalEvent[]> {
  const events = await loadSharedEvents(options.force);
  return eventEngine.getRelated(events, eventId);
}
