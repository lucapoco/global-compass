import type { Earthquake } from "@/types";
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";
import { detectPrimaryCountry } from "@/services/intelligence/nlp/entityExtractor";

function countryFromPlace(place: string): string | undefined {
  const detected = detectPrimaryCountry(place);
  if (detected) return detected;
  const tail = place.split(",").pop()?.trim();
  if (!tail || tail.length < 3) return undefined;
  // Skip bare US state / region codes (e.g. "CA", "OK") — not countries.
  if (/^[A-Z]{2}$/.test(tail)) return undefined;
  return tail;
}

/** USGS earthquake feed → GlobalEvent. Always treated as live + verified (authoritative feed). */
export function normalizeEarthquake(eq: Earthquake): GlobalEvent {
  return createGlobalEvent({
    id: `usgs-${eq.id}`,
    title: `M${eq.magnitude.toFixed(1)} — ${eq.place}`,
    description: `Depth ${eq.depth.toFixed(1)} km`,
    category: "earthquake",
    severity: "low", // overwritten by scoring engine using magnitude
    source: "USGS",
    sourceUrl: eq.url,
    provider: "usgs",
    country: countryFromPlace(eq.place),
    locationName: eq.place,
    coordinates: { lat: eq.latitude, lng: eq.longitude },
    timestamp: toIsoOrNow(eq.time),
    tags: tokenize(eq.place).slice(0, 6),
    status: "live",
    live: true,
    verified: true,
    metadata: { originalId: eq.id, magnitude: eq.magnitude, depthKm: eq.depth },
  });
}
