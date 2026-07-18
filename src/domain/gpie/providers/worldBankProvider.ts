/**
 * World Bank Provider
 *
 * Fetches macroeconomic and development indicators for a specific country
 * from the World Bank Open Data API (v2).
 *
 * No API key required — the endpoint is public and CORS-enabled.
 *
 * Caching strategy:
 *  - Per-country in-memory Map, TTL = 24 hours.
 *  - World Bank data is updated annually; a 24-hour TTL avoids redundant
 *    network round-trips while ensuring a fresh fetch each session.
 *  - Individual indicators that fail (404, timeout) return null rather than
 *    aborting the entire batch — partial data is always better than nothing.
 *
 * Country code note:
 *  - The World Bank API accepts ISO-3166 alpha-2 AND alpha-3 codes.
 *  - This service accepts alpha-2 (cca2) as used throughout the application.
 */
import { WB_INDICATORS, type WorldBankIndicators, type WorldBankIndicatorResponse } from "../models/WorldBankData";

const WB_BASE = "https://api.worldbank.org/v2/country";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: WorldBankIndicators;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/* ── Single-indicator fetch ─────────────────────────────────────────────── */

async function fetchIndicator(
  countryCode: string,
  indicatorCode: string,
): Promise<{ value: number | null; year: number | null; countryName: string | null }> {
  const url = `${WB_BASE}/${encodeURIComponent(countryCode)}/indicator/${indicatorCode}?format=json&mrv=1&per_page=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return { value: null, year: null, countryName: null };

  const json = (await res.json()) as [unknown, WorldBankIndicatorResponse[] | null];
  const record = json[1]?.[0];

  if (!record) return { value: null, year: null, countryName: null };

  return {
    value: record.value,
    year: record.date ? parseInt(record.date, 10) : null,
    countryName: record.country?.value ?? null,
  };
}

/* ── Batch fetch ────────────────────────────────────────────────────────── */

/**
 * Fetch all GPIE indicators for a country in parallel.
 *
 * Uses `Promise.allSettled` so a single failing indicator cannot abort the
 * whole batch. Failing indicators surface as `null` values in the result.
 *
 * @param countryCode  ISO-3166 alpha-2 or alpha-3 code (e.g. "US", "DEU")
 * @returns Normalised WorldBankIndicators or null if all fetches fail.
 */
export async function getWorldBankData(countryCode: string): Promise<WorldBankIndicators | null> {
  const key = countryCode.toUpperCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  try {
    const [
      gdp,
      gdpPerCapita,
      population,
      inflation,
      lifeExpectancy,
      co2,
      energy,
      internet,
      govEff,
      unemployment,
    ] = await Promise.allSettled([
      fetchIndicator(key, WB_INDICATORS.GDP),
      fetchIndicator(key, WB_INDICATORS.GDP_PER_CAPITA),
      fetchIndicator(key, WB_INDICATORS.POPULATION),
      fetchIndicator(key, WB_INDICATORS.INFLATION),
      fetchIndicator(key, WB_INDICATORS.LIFE_EXPECTANCY),
      fetchIndicator(key, WB_INDICATORS.CO2),
      fetchIndicator(key, WB_INDICATORS.ENERGY_USE),
      fetchIndicator(key, WB_INDICATORS.INTERNET_USAGE),
      fetchIndicator(key, WB_INDICATORS.GOV_EFFECTIVENESS),
      fetchIndicator(key, WB_INDICATORS.UNEMPLOYMENT),
    ]);

    const val = <T>(result: PromiseSettledResult<T>, fallback: null = null) =>
      result.status === "fulfilled" ? result.value : fallback;

    // Determine the most recent year across all indicators
    const years = [gdp, gdpPerCapita, population, inflation, lifeExpectancy]
      .map((r) => (r.status === "fulfilled" ? r.value.year : null))
      .filter((y): y is number => y !== null);
    const dataYear = years.length ? Math.max(...years) : null;

    const countryName =
      gdp.status === "fulfilled"
        ? gdp.value.countryName
        : population.status === "fulfilled"
          ? population.value.countryName
          : null;

    const data: WorldBankIndicators = {
      countryCode: key,
      countryName,
      gdpCurrentUSD: val(gdp)?.value ?? null,
      gdpPerCapitaUSD: val(gdpPerCapita)?.value ?? null,
      population: val(population)?.value ?? null,
      inflationPct: val(inflation)?.value ?? null,
      lifeExpectancy: val(lifeExpectancy)?.value ?? null,
      co2EmissionsPerCapita: val(co2)?.value ?? null,
      energyUsePerCapita: val(energy)?.value ?? null,
      internetUsagePct: val(internet)?.value ?? null,
      govEffectivenessScore: val(govEff)?.value ?? null,
      unemploymentPct: val(unemployment)?.value ?? null,
      dataYear,
      fetchedAt: Date.now(),
    };

    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (e) {
    console.warn("[worldBankProvider] fetch failed for", countryCode, e);
    return null;
  }
}

/** Invalidate the cached entry for a specific country (e.g. for forced refresh). */
export function clearWorldBankCache(countryCode?: string): void {
  if (countryCode) {
    cache.delete(countryCode.toUpperCase());
  } else {
    cache.clear();
  }
}

/** Return the cache status for a country (for debug / status panels). */
export function getWorldBankCacheStatus(countryCode: string): {
  cached: boolean;
  ageMs: number | null;
  stale: boolean;
} {
  const entry = cache.get(countryCode.toUpperCase());
  if (!entry) return { cached: false, ageMs: null, stale: true };
  const ageMs = Date.now() - entry.fetchedAt;
  return { cached: true, ageMs, stale: ageMs > TTL_MS };
}
