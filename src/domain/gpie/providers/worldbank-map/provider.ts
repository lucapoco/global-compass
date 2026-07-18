/**
 * World Bank Map Provider — Domain Layer
 *
 * Implements the `GeoIntelProvider` contract. Powers the Economic
 * Indicators, Population, and Energy map layers by joining bulk World Bank
 * indicators with REST Countries coordinates — no server proxy needed
 * (both upstream APIs are public/CORS-enabled already).
 */
import { getAllCountries } from "@/services/countriesApi";
import { fetchBulkIndicator } from "./bulkFetch";
import { normalizeWorldBankMapEvents, type WorldBankMapIndicators } from "./normalizer";
import { WB_INDICATORS } from "../../models/WorldBankData";
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import { toEventProvider, type GeoIntelProvider, type ProviderHealth } from "../providerContract";
import type { ProviderLoadContext, EventProvider } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { Country } from "@/types";

const TTL_MS = 24 * 60 * 60 * 1000; // World Bank data updates annually

interface RawBundle {
  countries: Country[];
  indicators: WorldBankMapIndicators;
}

async function fetchWorldBankMapData(): Promise<RawBundle> {
  const [countries, gdpPerCapita, population, energyUse] = await Promise.all([
    getAllCountries(),
    fetchBulkIndicator(WB_INDICATORS.GDP_PER_CAPITA),
    fetchBulkIndicator(WB_INDICATORS.POPULATION),
    fetchBulkIndicator(WB_INDICATORS.ENERGY_USE),
  ]);

  return { countries, indicators: { gdpPerCapita, population, energyUse } };
}

export const worldBankMapGeoIntelProvider: GeoIntelProvider<RawBundle> = {
  id: "world_bank",
  label: "World Bank (Economic, Population & Energy Indicators)",
  ttlMs: TTL_MS,
  cache: new ProviderCache<GlobalEvent[]>(TTL_MS),

  async fetch(_ctx?: ProviderLoadContext): Promise<RawBundle[]> {
    return [await fetchWorldBankMapData()];
  },

  normalize(raw: RawBundle[]): GlobalEvent[] {
    const bundle = raw[0];
    if (!bundle) return [];
    return normalizeWorldBankMapEvents(bundle.countries, bundle.indicators);
  },

  async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const sample = await fetchBulkIndicator(WB_INDICATORS.POPULATION);
      return { ok: sample.size > 0, message: `World Bank reachable (${sample.size} countries).`, checkedAt };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, message: `World Bank unreachable: ${message}`, checkedAt };
    }
  },
};

export const worldBankMapProvider: EventProvider = toEventProvider(worldBankMapGeoIntelProvider);
