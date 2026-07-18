/**
 * Joins REST Countries reference data (coordinates, names) with bulk World
 * Bank indicators to produce map-plottable `GlobalEvent`s for the Economic
 * Indicators, Population, and Energy intelligence layers.
 *
 * These are reference/statistical snapshots, not incidents — severity is
 * always "low" (informational) and `live` reflects that the underlying
 * figures are the latest published World Bank release, not a real-time feed.
 */
import type { Country } from "@/types";
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { formatGDP, formatPopulation } from "../../models/WorldBankData";
import type { BulkIndicatorValue } from "./bulkFetch";

export interface WorldBankMapIndicators {
  gdpPerCapita: Map<string, BulkIndicatorValue>;
  population: Map<string, BulkIndicatorValue>;
  energyUse: Map<string, BulkIndicatorValue>;
}

function coordsOf(country: Country): { lat: number; lng: number } | undefined {
  const [lat, lng] = country.latlng ?? [];
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined;
}

function yearToIso(year: number): string {
  return new Date(Date.UTC(year, 0, 1)).toISOString();
}

export function normalizeWorldBankMapEvents(countries: Country[], indicators: WorldBankMapIndicators): GlobalEvent[] {
  const events: GlobalEvent[] = [];

  for (const country of countries) {
    const iso3 = country.cca3;
    const coordinates = coordsOf(country);
    if (!iso3 || !coordinates) continue;

    const gdp = indicators.gdpPerCapita.get(iso3);
    if (gdp) {
      events.push(createGlobalEvent({
        id: `wb-econ-${iso3}`,
        title: `${country.name.common}: GDP per capita ${formatGDP(gdp.value)}`,
        description: `World Bank economic indicator, ${gdp.year} data.`,
        category: "economy",
        subCategory: "gdp_per_capita",
        severity: "low",
        source: "World Bank",
        provider: "world_bank",
        country: country.name.common,
        countryCode: country.cca2 ?? iso3,
        locationName: country.name.common,
        coordinates,
        timestamp: yearToIso(gdp.year),
        tags: ["economy", "gdp", country.region ?? ""].filter(Boolean),
        status: "cached",
        live: false,
        verified: true,
        metadata: { indicator: "gdp_per_capita", value: gdp.value, year: gdp.year },
      }));
    }

    const pop = indicators.population.get(iso3);
    if (pop) {
      events.push(createGlobalEvent({
        id: `wb-pop-${iso3}`,
        title: `${country.name.common}: population ${formatPopulation(pop.value)}`,
        description: `World Bank demographic indicator, ${pop.year} data.`,
        category: "country",
        subCategory: "population",
        severity: "low",
        source: "World Bank",
        provider: "world_bank",
        country: country.name.common,
        countryCode: country.cca2 ?? iso3,
        locationName: country.name.common,
        coordinates,
        timestamp: yearToIso(pop.year),
        tags: ["population", "demographics", country.region ?? ""].filter(Boolean),
        status: "cached",
        live: false,
        verified: true,
        metadata: { indicator: "population", value: pop.value, year: pop.year },
      }));
    }

    const energy = indicators.energyUse.get(iso3);
    if (energy) {
      events.push(createGlobalEvent({
        id: `wb-energy-${iso3}`,
        title: `${country.name.common}: energy use ${energy.value.toFixed(0)} kgoe/capita`,
        description: `World Bank energy consumption indicator, ${energy.year} data.`,
        category: "energy",
        subCategory: "energy_use",
        severity: "low",
        source: "World Bank",
        provider: "world_bank",
        country: country.name.common,
        countryCode: country.cca2 ?? iso3,
        locationName: country.name.common,
        coordinates,
        timestamp: yearToIso(energy.year),
        tags: ["energy", "consumption", country.region ?? ""].filter(Boolean),
        status: "cached",
        live: false,
        verified: true,
        metadata: { indicator: "energy_use", value: energy.value, year: energy.year },
      }));
    }
  }

  return events;
}
