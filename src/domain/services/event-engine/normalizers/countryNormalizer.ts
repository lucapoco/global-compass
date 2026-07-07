import type { Country } from "@/types";
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";

/** REST Countries entry → GlobalEvent (an informational "capital" marker, not a live incident). */
export function normalizeCountry(country: Country): GlobalEvent {
  const [lat, lng] = country.latlng ?? [];
  const coordinates = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined;

  return createGlobalEvent({
    id: `country-${country.cca3 ?? country.name.common}`,
    title: country.capital?.[0] ? `${country.capital[0]} (${country.name.common})` : country.name.common,
    description: country.region ? `${country.region}${country.subregion ? ` · ${country.subregion}` : ""}` : undefined,
    category: "country",
    severity: "low",
    source: "REST Countries",
    provider: "rest_countries",
    country: country.name.common,
    countryCode: country.cca2 ?? country.cca3,
    locationName: country.capital?.[0],
    coordinates,
    timestamp: new Date().toISOString(),
    image: country.flags?.svg ?? country.flags?.png,
    tags: [country.region, country.subregion].filter(Boolean) as string[],
    status: "live",
    live: true,
    verified: true,
    metadata: {
      population: country.population,
      area: country.area,
      region: country.region,
      subregion: country.subregion,
    },
  });
}
