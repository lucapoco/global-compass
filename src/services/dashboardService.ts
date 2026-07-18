/**
 * Dashboard data — sourced entirely from the centralized `IntelligenceStore`.
 *
 * Previously this fanned out to `newsApi` (GNews only), `earthquakesApi`
 * (USGS only), `countriesApi`, and `riskService` independently. It now
 * reads ONE shared, already deduplicated/scored/correlated event list from
 * every active provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED,
 * NASA FIRMS, World Bank, REST Countries, ...) and adapts it back into the
 * exact `IntelligenceItem[]` / `Earthquake[]` / `CountryRisk[]` shapes the
 * existing dashboard panels already render — so the panels themselves never
 * had to change, but the platform behind them did.
 *
 * The 60s local cache below is a thin wrapper over the store's own 90s
 * shared-event cache — it exists only to coalesce the handful of derived
 * fields (saved alerts/countries counts) that are genuinely Supabase-owned
 * user data, not provider intelligence.
 */
import type { Earthquake, IntelligenceItem, SavedAlert, CountryRisk } from "@/types";
import type { NewsStatus } from "./newsApi";
import { isSupabaseConfigured, supabaseService } from "./supabaseService";
import { getDashboardData, invalidateIntelligenceStore } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes, toCountryRisks } from "@/domain/adapters/legacyIntelAdapter";
import { getAllCountries } from "./countriesApi";

export interface DashboardSnapshot {
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
 * caches for 60s so multiple Dashboard panels never duplicate work.
 */
export async function getDashboardSnapshot(force = false): Promise<DashboardSnapshot> {
  if (!force && cached && Date.now() - cached.fetchedAt < TTL) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [data, savedAlerts, savedCountriesCount, countriesTotal] = await Promise.all([
      getDashboardData({ force }),
      isSupabaseConfigured() ? supabaseService.listSavedAlerts().catch(() => []) : Promise.resolve([]),
      isSupabaseConfigured() ? supabaseService.listSavedCountries().then((c) => c.length).catch(() => null) : Promise.resolve(null),
      getAllCountries().then((c) => c.length).catch(() => null),
    ]);

    const intel = toIntelligenceItems(data.events);
    const quakes = toEarthquakes(data.events);
    const countryCount = countriesTotal;
    const newsStatus: NewsStatus = data.events.some((e) => e.live) ? "live" : data.events.length > 0 ? "cached" : "demo";

    const snap: DashboardSnapshot = {
      newsStatus,
      quakes,
      intel,
      countryCount,
      savedAlerts,
      savedCountriesCount,
      risks: toCountryRisks(data.topRiskCountries),
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
  invalidateIntelligenceStore();
}
