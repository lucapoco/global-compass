/**
 * ReliefWeb (UN OCHA) disaster record → GlobalEvent.
 *
 * Response shape (see routes/api/public/reliefweb-proxy.ts):
 *   { id, fields: { name, country: [{ name, iso3, location?: { lat, lon } }],
 *     type: [{ name }], date: { created, changed }, url } }
 */
import { createGlobalEvent, type GlobalEvent, type GlobalEventCategory } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";
import { getCountryCentroid } from "@/domain/utils/countryCentroids";

export interface ReliefWebRecord {
  id: string | number;
  fields?: {
    name?: string;
    country?: Array<{ name?: string; iso3?: string; location?: { lat?: number; lon?: number } }>;
    type?: Array<{ name?: string }>;
    date?: { created?: string; changed?: string };
    url?: string;
    "description-html"?: string;
  };
}

/** ReliefWeb disaster-type taxonomy → Global Pulse category/subCategory. */
const TYPE_MAP: Record<string, { category: GlobalEventCategory; subCategory: string }> = {
  flood: { category: "disaster", subCategory: "flood" },
  earthquake: { category: "earthquake", subCategory: "earthquake" },
  epidemic: { category: "health", subCategory: "epidemic" },
  drought: { category: "climate", subCategory: "drought" },
  "tropical cyclone": { category: "weather", subCategory: "storm" },
  volcano: { category: "disaster", subCategory: "volcano" },
  fire: { category: "disaster", subCategory: "wildfire" },
  "complex emergency": { category: "geopolitics", subCategory: "humanitarian_crisis" },
  "cold wave": { category: "weather", subCategory: "cold_wave" },
  "heat wave": { category: "weather", subCategory: "heat_wave" },
  "land slide": { category: "disaster", subCategory: "landslide" },
  tsunami: { category: "disaster", subCategory: "tsunami" },
  insect: { category: "disaster", subCategory: "infestation" },
};

function classifyType(typeName: string | undefined): { category: GlobalEventCategory; subCategory: string } {
  if (!typeName) return { category: "geopolitics", subCategory: "humanitarian_crisis" };
  return TYPE_MAP[typeName.toLowerCase()] ?? { category: "geopolitics", subCategory: "humanitarian_crisis" };
}

export function normalizeReliefWebRecord(record: ReliefWebRecord): GlobalEvent | null {
  const f = record.fields;
  if (!f?.name) return null;

  const country = f.country?.[0];
  const typeInfo = classifyType(f.type?.[0]?.name);
  const centroid = country?.location?.lat && country?.location?.lon
    ? { lat: country.location.lat, lng: country.location.lon }
    : getCountryCentroid(country?.name);

  return createGlobalEvent({
    id: `reliefweb-${record.id}`,
    title: f.name,
    description: `Humanitarian situation: ${f.type?.[0]?.name ?? "crisis"} in ${country?.name ?? "affected area"}.`,
    category: typeInfo.category,
    subCategory: typeInfo.subCategory,
    severity: "high", // ReliefWeb only lists currently-active humanitarian disasters — treated as high by default
    source: "ReliefWeb (UN OCHA)",
    sourceUrl: f.url,
    provider: "reliefweb",
    country: country?.name,
    locationName: country?.name,
    coordinates: centroid,
    timestamp: toIsoOrNow(f.date?.created),
    tags: tokenize(`${f.name} humanitarian ${f.type?.[0]?.name ?? ""}`).slice(0, 6),
    status: "live",
    live: true,
    verified: true,
    metadata: {
      originalId: record.id,
      disasterType: f.type?.[0]?.name,
      iso3: country?.iso3,
      approximateLocation: !country?.location?.lat,
    },
  });
}

export function normalizeReliefWebBatch(records: ReliefWebRecord[]): GlobalEvent[] {
  return records.map(normalizeReliefWebRecord).filter((e): e is GlobalEvent => e !== null);
}
