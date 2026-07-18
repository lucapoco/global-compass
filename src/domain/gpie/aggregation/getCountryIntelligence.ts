/**
 * getCountryIntelligence
 *
 * Unified aggregation service for country-level intelligence.
 *
 * Combines:
 *   • All GlobalEvents from the EventEngine filtered to the requested country
 *   • World Bank macroeconomic indicators (via worldBankProvider, 24-hour cache)
 *
 * Usage:
 *   const profile = await getCountryIntelligence("France", "FR");
 *   // profile.events          — all events for France
 *   // profile.worldBankData   — GDP, population, etc.
 *   // profile.risk.score      — 0–100 composite risk
 *
 * This is the ONLY function country pages should call.
 * The UI must never reach directly into individual API services.
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import { getWorldBankData } from "../providers/worldBankProvider";
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type {
  CountryIntelligenceProfile,
  CountryEventCounts,
  CountryRiskAssessment,
  RiskTier,
} from "../models/CountryIntelligence";
import { isIntelligenceSignal } from "@/domain/constants/metadataProviders";

/* ── Event filtering ────────────────────────────────────────────────────── */

/**
 * Flexible country matcher — handles mismatched case, "United States" vs "US",
 * and partial name variants that appear across different data providers.
 */
function matchesCountry(event: GlobalEvent, countryName: string, countryCode?: string): boolean {
  if (!isIntelligenceSignal(event)) return false;

  const target = countryName.toLowerCase().trim();
  const blob = `${event.title} ${event.description ?? ""} ${event.summary ?? ""} ${event.locationName ?? ""}`.toLowerCase();

  if (event.country) {
    const source = event.country.toLowerCase().trim();
    if (source === target || source.includes(target) || target.includes(source)) return true;
  }

  if (countryCode) {
    const code = countryCode.toLowerCase();
    const meta = event.metadata as { countryCode?: string; cca2?: string } | undefined;
    const eventCode = (meta?.countryCode ?? meta?.cca2)?.toLowerCase();
    if (eventCode && eventCode === code) return true;
  }

  // Events without a country field may still mention the country in text.
  if (blob.includes(target)) return true;

  return false;
}

/* ── Event statistics ───────────────────────────────────────────────────── */

function countEvents(events: GlobalEvent[]): CountryEventCounts {
  const bySeverity: Record<GlobalEventSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byCategory: Partial<Record<GlobalEventCategory, number>> = {};

  for (const e of events) {
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }

  return { total: events.length, bySeverity, byCategory };
}

/* ── Risk algorithm ─────────────────────────────────────────────────────── */

/**
 * Composite risk score (0–100) algorithm:
 *
 *  Base score:
 *    CRITICAL events  × 20  (capped contribution at 60)
 *    HIGH events      × 10  (capped at 30)
 *    MEDIUM events    × 3   (capped at 15)
 *    LOW events       × 0.5 (capped at 5)
 *
 *  The base is clamped to 100. This gives a useful reading even for
 *  countries with only low-severity events.
 *
 *  Bonus drivers:
 *    +10 if any ACLED military events exist
 *    +5  if any NASA EONET open natural disasters exist
 *    +5  if more than 20 events in total (high-activity signal)
 */
function computeCountryRisk(events: GlobalEvent[]): CountryRiskAssessment {
  const counts = countEvents(events);
  const { critical, high, medium, low } = counts.bySeverity;

  const base =
    Math.min(critical * 20, 60) +
    Math.min(high * 10, 30) +
    Math.min(medium * 3, 15) +
    Math.min(low * 0.5, 5);

  let bonus = 0;
  const drivers: string[] = [];

  const hasMilitary = events.some((e) => e.provider === "acled" && e.live);
  const hasNaturalDisaster = events.some((e) => e.provider === "nasa_eonet" && e.live);
  const isHighActivity = events.length > 20;
  const hasCritical = critical > 0;

  if (hasCritical) {
    drivers.push(`${critical} critical severity event${critical > 1 ? "s" : ""}`);
    bonus += 5;
  }
  if (hasMilitary) {
    drivers.push("Active armed conflict (ACLED)");
    bonus += 10;
  }
  if (hasNaturalDisaster) {
    drivers.push("Open natural disaster (NASA EONET)");
    bonus += 5;
  }
  if (isHighActivity) {
    drivers.push(`High event density (${events.length} events)`);
    bonus += 5;
  }
  if (high > 3) {
    drivers.push(`${high} high-severity events`);
  }

  const score = Math.round(Math.min(100, base + bonus));

  const tier: RiskTier =
    score >= 75 ? "critical" :
    score >= 50 ? "high" :
    score >= 25 ? "medium" :
    score > 0   ? "low" : "unknown";

  return {
    score,
    tier,
    drivers: drivers.slice(0, 3),
  };
}

/* ── Pure builder (shared with IntelligenceStore) ──────────────────────── */

/**
 * Pure, synchronous profile assembly — takes an already-loaded event list
 * (e.g. from a shared cache) plus optional World Bank data, and never calls
 * the EventEngine itself. Exported so `IntelligenceStore` (the app-wide
 * single source of truth) can reuse this exact filtering/risk logic against
 * its own shared event cache instead of triggering a second independent
 * `eventEngine.loadAll()`.
 */
export function assembleCountryIntelligenceProfile(
  allEvents: GlobalEvent[],
  countryName: string,
  countryCode: string | undefined,
  worldBankData: CountryIntelligenceProfile["worldBankData"],
): CountryIntelligenceProfile {
  const events = allEvents.filter((e) => matchesCountry(e, countryName, countryCode));
  const eventCounts = countEvents(events);
  const risk = computeCountryRisk(events);

  return {
    countryName,
    countryCode,
    events,
    eventCounts,
    worldBankData,
    risk,
    lastUpdated: new Date().toISOString(),
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export interface GetCountryIntelligenceOptions {
  /** Bypass EventEngine and World Bank caches (default false). */
  force?: boolean;
  /** Skip World Bank fetch — useful for quick loads on the globe page. */
  skipWorldBank?: boolean;
}

/**
 * Assemble a complete intelligence profile for one country.
 *
 * @param countryName  Display name (e.g. "France", "United States")
 * @param countryCode  ISO-3166 alpha-2 code (e.g. "FR", "US") — required for World Bank
 * @param options      Cache and fetch behaviour overrides
 */
export async function getCountryIntelligence(
  countryName: string,
  countryCode?: string,
  options: GetCountryIntelligenceOptions = {},
): Promise<CountryIntelligenceProfile> {
  const [allEvents, worldBankData] = await Promise.all([
    eventEngine.loadAll({ force: options.force }),
    countryCode && !options.skipWorldBank
      ? getWorldBankData(countryCode)
      : Promise.resolve(null),
  ]);

  return assembleCountryIntelligenceProfile(allEvents, countryName, countryCode, worldBankData);
}
