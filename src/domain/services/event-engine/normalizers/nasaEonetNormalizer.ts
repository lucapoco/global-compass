/**
 * NASA EONET Normalizer
 *
 * Maps raw NASA Earth Observatory Natural Event Tracker (EONET) events
 * into the unified GlobalEvent domain model.
 *
 * EONET API reference: https://eonet.gsfc.nasa.gov/docs/v3
 *
 * Category mapping strategy:
 *  - Natural catastrophes → "disaster"
 *  - Atmospheric events   → "weather"
 *  - Ice/ocean events     → "climate"
 *  - Seismic events       → "earthquake" (rare in EONET, USGS is primary)
 *  - Everything else      → "disaster" (safe conservative default)
 */
import { createGlobalEvent, type GlobalEvent, type GlobalEventCategory } from "@/domain/models/GlobalEvent";
import { tokenize } from "@/domain/utils/text";
import { toIsoOrNow } from "@/domain/utils/time";

/* ── Raw EONET shapes ────────────────────────────────────────────────────── */

export interface EonetGeometry {
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  date: string;
  type: "Point" | "Polygon";
  coordinates: number[] | number[][][];
}

export interface EonetCategory {
  id: string;
  title: string;
}

export interface EonetSource {
  id: string;
  url: string;
}

export interface EonetRawEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  closed: string | null;
  categories: EonetCategory[];
  sources: EonetSource[];
  geometries: EonetGeometry[];
}

/* ── Category mapping ────────────────────────────────────────────────────── */

const EONET_CATEGORY_MAP: Record<string, GlobalEventCategory> = {
  wildfires: "disaster",
  floods: "disaster",
  volcanoes: "disaster",
  landslides: "disaster",
  severeStorms: "weather",
  snow: "weather",
  temperatureExtremes: "weather",
  dustAndHaze: "weather",
  seaAndLakeIce: "climate",
  drought: "climate",
  waterColor: "climate",
  earthquakes: "earthquake",
  manmade: "general",
};

function eonetCategory(categories: EonetCategory[]): GlobalEventCategory {
  for (const cat of categories) {
    const mapped = EONET_CATEGORY_MAP[cat.id];
    if (mapped) return mapped;
  }
  return "disaster";
}

/** Finer-grained hazard label used by the map's intelligence layers (Wildfires, Floods, Storms, Volcanoes...). */
const EONET_SUBCATEGORY_MAP: Record<string, string> = {
  wildfires: "wildfire",
  floods: "flood",
  volcanoes: "volcano",
  landslides: "landslide",
  severeStorms: "storm",
  snow: "snow",
  temperatureExtremes: "temperature_extreme",
  dustAndHaze: "dust_haze",
  seaAndLakeIce: "sea_ice",
  drought: "drought",
  waterColor: "water_color",
  earthquakes: "earthquake",
  manmade: "manmade",
};

function eonetSubCategory(categories: EonetCategory[]): string | undefined {
  for (const cat of categories) {
    const mapped = EONET_SUBCATEGORY_MAP[cat.id];
    if (mapped) return mapped;
  }
  return undefined;
}

/* ── Coordinate extraction ───────────────────────────────────────────────── */

function extractCoordinates(geom: EonetGeometry): { lat: number; lng: number } | undefined {
  if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
    const [lng, lat] = geom.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number" && isFinite(lat) && isFinite(lng)) {
      return { lat, lng };
    }
  }
  return undefined;
}

/* ── Normalizer ──────────────────────────────────────────────────────────── */

/**
 * NASA EONET event → GlobalEvent.
 *
 * Severity is initially "medium" for open events, "low" for closed ones —
 * the scoring engine refines it based on keyword analysis of the title.
 */
export function normalizeEonetEvent(raw: EonetRawEvent): GlobalEvent {
  const category = eonetCategory(raw.categories);
  const catLabel = raw.categories[0]?.title ?? "Natural Event";

  // Use the most recent geometry entry
  const latestGeom = raw.geometries[raw.geometries.length - 1] ?? null;
  const coordinates = latestGeom ? extractCoordinates(latestGeom) : undefined;
  const timestamp = toIsoOrNow(latestGeom?.date ?? "");

  const isOpen = !raw.closed;
  const description =
    raw.description?.trim() ||
    `${catLabel} — tracked by NASA Earth Observatory Natural Event Tracker`;

  return createGlobalEvent({
    id: `eonet-${raw.id}`,
    title: raw.title,
    description,
    category,
    subCategory: eonetSubCategory(raw.categories),
    severity: isOpen ? "medium" : "low",
    source: "NASA EONET",
    sourceUrl: raw.link,
    provider: "nasa_eonet",
    coordinates,
    locationName: coordinates ? undefined : catLabel,
    timestamp,
    image: undefined,
    tags: [
      catLabel.toLowerCase().replace(/\s+/g, "-"),
      ...raw.sources.map((s) => s.id.toLowerCase()).slice(0, 2),
      ...tokenize(raw.title).slice(0, 3),
    ].filter(Boolean),
    status: "live",
    live: isOpen,
    verified: true,
    metadata: {
      originalId: raw.id,
      closed: raw.closed,
      eonetCategories: raw.categories,
      geometryCount: raw.geometries.length,
      magnitudeValue: latestGeom?.magnitudeValue ?? null,
      magnitudeUnit: latestGeom?.magnitudeUnit ?? null,
      sources: raw.sources,
    },
  });
}
