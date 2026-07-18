/**
 * Decision Engine — Main Service Facade
 *
 * This is the single entry point for all Decision Support Engine functionality.
 * The UI should call ONLY this service; it never reaches into sub-modules directly.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CACHING STRATEGY
 * ─────────────────────────────────────────────────────────────────────────
 * Expensive calculations are cached in-memory with TTLs:
 *
 *   Global Stability Index     — 5 minutes
 *   Regional Stability Index   — 5 minutes
 *   Analytics Summary          — 3 minutes
 *   Change Detection           — 2 minutes
 *   Emerging Risks             — 3 minutes
 *
 * Country-specific results are cached for 5 minutes by country name.
 * All caches are invalidated when `invalidateAll()` is called.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ─────────────────────────────────────────────────────────────────────────
 *   • All methods are async (eventEngine.loadAll is async)
 *   • All returned objects are fully typed
 *   • No fake data — all values derived from real events
 *   • Every score includes an explanation
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import { getWorldBankData } from "@/domain/gpie/providers/worldBankProvider";

import { computeGlobalStabilityIndex, computeCountryStabilityIndex, computeRegionalStabilityIndex } from "../stability/stabilityEngine";
import { explainGSI, explainCSI, explainRiskScore } from "../explainability/scoreExplainer";
import { buildAnalyticsSummary } from "../analytics/analyticsService";
import { detectChanges } from "../changeDetection/changeDetector";
import { detectEmergingRisks } from "../emerging/emergingRisks";
import { compareCountries } from "../comparison/countryComparator";
import {
  buildGlobalSummary,
  buildCountrySummary,
  buildRegionalSummary,
  buildDailyBriefing,
  buildWeeklyBriefing,
  buildExecutiveSummary,
  buildEmergencyBriefing,
  type SummaryType,
} from "../summary/summaryEngine";
import {
  generateGlobalReport,
  generateCountryReport,
  generateRegionalReport,
  generateDailyBriefing,
  generateEmergencyBriefing,
} from "../reports/reportGenerator";

import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { GlobalStabilityIndex, CountryStabilityIndex, RegionalStabilityIndex } from "../models/StabilityIndex";
import type { AnalyticsSummary, ExecutiveReport, CountryComparison, EmergingRisk, PlatformChangeSummary, ChangeWindowId } from "../models/ReportModel";
import type { IntelligenceSummary } from "../summary/summaryEngine";
import type { ScoreExplanation } from "../explainability/scoreExplainer";

// ─── Simple TTL cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class DecisionCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

const cache = new DecisionCache();

// ─── Cache keys & TTLs ────────────────────────────────────────────────────────

const TTL = {
  gsi:      5 * 60_000,
  rsi:      5 * 60_000,
  analytics: 3 * 60_000,
  changes:   2 * 60_000,
  emerging:  3 * 60_000,
  country:   5 * 60_000,
};

// ─── Event loading ────────────────────────────────────────────────────────────

async function loadEvents(): Promise<GlobalEvent[]> {
  return eventEngine.loadAll();
}

// ─── Public service methods ───────────────────────────────────────────────────

/** Global Stability Index with full factor breakdown and confidence model. */
export async function getGlobalStabilityIndex(): Promise<GlobalStabilityIndex> {
  const cached = cache.get<GlobalStabilityIndex>("gsi");
  if (cached) return cached;
  const events = await loadEvents();
  const gsi = computeGlobalStabilityIndex(events);
  cache.set("gsi", gsi, TTL.gsi);
  return gsi;
}

/** Human-readable explanation of the current Global Stability Index. */
export async function explainGlobalStability(): Promise<ScoreExplanation> {
  const gsi = await getGlobalStabilityIndex();
  return explainGSI(gsi);
}

/** Country Stability Index for a specific country. */
export async function getCountryStabilityIndex(countryName: string): Promise<CountryStabilityIndex> {
  const key = `csi:${countryName.toLowerCase()}`;
  const cached = cache.get<CountryStabilityIndex>(key);
  if (cached) return cached;
  const events = await loadEvents();
  const csi = computeCountryStabilityIndex(events, countryName);
  cache.set(key, csi, TTL.country);
  return csi;
}

/** Explanation for a country's stability score. */
export async function explainCountryStability(countryName: string): Promise<ScoreExplanation> {
  const csi = await getCountryStabilityIndex(countryName);
  return explainCSI(csi);
}

/** Risk score explanation for a set of events (used by event detail views). */
export function explainEventRisk(events: GlobalEvent[], label?: string): ScoreExplanation {
  const avgRisk = events.length > 0
    ? Math.round(events.reduce((s, e) => s + e.riskScore, 0) / events.length)
    : 0;
  return explainRiskScore(avgRisk, events, label);
}

/** Regional Stability Index for all 7 regions. */
export async function getRegionalStabilityIndex(): Promise<RegionalStabilityIndex> {
  const cached = cache.get<RegionalStabilityIndex>("rsi");
  if (cached) return cached;
  const events = await loadEvents();
  const rsi = computeRegionalStabilityIndex(events);
  cache.set("rsi", rsi, TTL.rsi);
  return rsi;
}

/** Analytics dashboard summary. */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const cached = cache.get<AnalyticsSummary>("analytics");
  if (cached) return cached;
  const events = await loadEvents();
  const analytics = buildAnalyticsSummary(events);
  cache.set("analytics", analytics, TTL.analytics);
  return analytics;
}

/** Change detection for the specified window. */
export async function getChanges(windowId: ChangeWindowId = "24h"): Promise<PlatformChangeSummary> {
  const key = `changes:${windowId}`;
  const cached = cache.get<PlatformChangeSummary>(key);
  if (cached) return cached;
  const events = await loadEvents();
  const changes = detectChanges(events, windowId);
  cache.set(key, changes, TTL.changes);
  return changes;
}

/** Emerging risks detector. */
export async function getEmergingRisks(): Promise<EmergingRisk[]> {
  const cached = cache.get<EmergingRisk[]>("emerging");
  if (cached) return cached;
  const events = await loadEvents();
  const risks = detectEmergingRisks(events);
  cache.set("emerging", risks, TTL.emerging);
  return risks;
}

/** Country comparison. */
export async function getCountryComparison(
  countryA: string,
  countryB: string,
): Promise<CountryComparison> {
  const key = `compare:${countryA.toLowerCase()}:${countryB.toLowerCase()}`;
  const cached = cache.get<CountryComparison>(key);
  if (cached) return cached;

  const [events, wbA, wbB] = await Promise.all([
    loadEvents(),
    getWorldBankData(countryA).catch(() => null),
    getWorldBankData(countryB).catch(() => null),
  ]);

  const comparison = compareCountries(events, countryA, countryB, wbA, wbB);
  cache.set(key, comparison, TTL.country);
  return comparison;
}

/** Intelligence summary by type. */
export async function getIntelligenceSummary(
  type: SummaryType,
  subject?: string,
): Promise<IntelligenceSummary> {
  const key = `summary:${type}:${subject ?? ""}`;
  const cached = cache.get<IntelligenceSummary>(key);
  if (cached) return cached;

  const events = await loadEvents();
  let summary: IntelligenceSummary;

  switch (type) {
    case "global":
      summary = buildGlobalSummary(events);
      break;
    case "country":
      summary = buildCountrySummary(events, subject ?? "Unknown");
      break;
    case "regional":
      summary = buildRegionalSummary(events, subject ?? "Europe");
      break;
    case "daily_briefing":
      summary = buildDailyBriefing(events);
      break;
    case "weekly_briefing":
      summary = buildWeeklyBriefing(events);
      break;
    case "executive":
      summary = buildExecutiveSummary(events);
      break;
    case "emergency":
      summary = buildEmergencyBriefing(events);
      break;
    default:
      summary = buildGlobalSummary(events);
  }

  cache.set(key, summary, TTL.gsi);
  return summary;
}

/** Generate an executive report. */
export async function generateReport(
  type: "global" | "country" | "regional" | "daily_briefing" | "emergency",
  subject?: string,
): Promise<ExecutiveReport> {
  const events = await loadEvents();

  switch (type) {
    case "country": {
      const wb = subject ? await getWorldBankData(subject).catch(() => null) : null;
      return generateCountryReport(events, subject ?? "Unknown", wb);
    }
    case "regional":
      return generateRegionalReport(events, subject ?? "Europe");
    case "daily_briefing":
      return generateDailyBriefing(events);
    case "emergency":
      return generateEmergencyBriefing(events);
    default:
      return generateGlobalReport(events);
  }
}

/** Invalidate all cached calculations. */
export function invalidateDecisionCache(): void {
  cache.invalidateAll();
}

/** Return current cache stats for debugging / auditability. */
export function getDecisionCacheStats(): { entries: number } {
  return { entries: cache.size };
}
