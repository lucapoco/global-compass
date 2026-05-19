import type { Earthquake, IntelligenceItem, SavedAlert, CountryRisk } from "@/types";
import type { NewsResult, NewsStatus } from "./newsApi";
import { fetchIntelligence } from "./newsApi";
import { getEarthquakes } from "./earthquakesApi";
import { getAllCountries } from "./countriesApi";
import { isSupabaseConfigured, supabaseService } from "./supabaseService";
import { buildCountryRiskIndex } from "./riskService";

export interface DashboardSnapshot {
  news: NewsResult;
  newsStatus: NewsStatus;
  quakes: Earthquake[];
  intel: IntelligenceItem[];
  countryCount: number | null;
  savedAlerts: SavedAlert[];
  savedCountriesCount: number | null;
  risks: CountryRisk[];
  fetchedAt: number;
}

let cached: DashboardSnapshot | null = null;
let inFlight: Promise<DashboardSnapshot> | null = null;
const TTL = 60_000; // share the same snapshot for 60s

/**
 * Centralized one-shot dashboard fetch. Coalesces concurrent callers and
 * caches for 60s so multiple Dashboard panels never duplicate API hits.
 */
export async function getDashboardSnapshot(force = false): Promise<DashboardSnapshot> {
  if (!force && cached && Date.now() - cached.fetchedAt < TTL) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [news, quakes, countries, savedAlerts, savedCountries] = await Promise.all([
      /** Load up to 30 for risk / charts; LiveIntelligencePanel shows top 12. */
      fetchIntelligence({ limit: 30, force }),
      getEarthquakes("day").catch(() => [] as Earthquake[]),
      getAllCountries().then((c) => c.length).catch(() => null),
      isSupabaseConfigured() ? supabaseService.listSavedAlerts().catch(() => []) : Promise.resolve([]),
      isSupabaseConfigured() ? supabaseService.listSavedCountries().then((c) => c.length).catch(() => null) : Promise.resolve(null),
    ]);

    const risks = buildCountryRiskIndex({ intel: news.items, quakes, saved: savedAlerts });

    const snap: DashboardSnapshot = {
      news,
      newsStatus: news.status,
      quakes,
      intel: news.items,
      countryCount: countries,
      savedAlerts,
      savedCountriesCount: savedCountries,
      risks,
      fetchedAt: Date.now(),
    };
    cached = snap;
    return snap;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function invalidateDashboardCache() {
  cached = null;
}
