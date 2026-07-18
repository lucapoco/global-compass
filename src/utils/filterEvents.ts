import type { GlobalEvent, GlobalEventCategory, GlobalEventProvider } from "@/domain/models/GlobalEvent";

/**
 * UI-facing "intelligence layer" toggles shown on the map. Each layer maps to
 * one or more `GlobalEventProvider`s, optionally narrowed further by
 * `categories` and/or `subCategories` — this lets a single rich provider
 * (GDACS covers earthquakes/floods/storms/volcanoes/drought/wildfires; the
 * World Bank map provider covers GDP/population/energy; GNews/GDELT/RSS
 * cover every news category) power several independent, filterable layers
 * without duplicating providers.
 *
 * `defaultEnabled` drives both the initial UI toggle state AND which
 * providers are fetched on first load — layers left off by default are
 * fetched lazily, the first time the user turns them on (Performance: avoid
 * unnecessary API requests). Each provider still owns its own TTL cache, so
 * toggling a layer off and back on never re-fetches unless the cache is stale.
 */
export interface LayerGroup {
  id: string;
  label: string;
  providers: GlobalEventProvider[];
  /** Narrows matched providers to specific categories (e.g. Technology/Cyber/Health news). */
  categories?: GlobalEventCategory[];
  /** Narrows matched providers to specific `subCategory` values (e.g. "wildfire", "flood"). */
  subCategories?: string[];
  /** Whether this layer is ON when the map first loads. Defaults to true when omitted. */
  defaultEnabled?: boolean;
  /** Purely visual/derived layer (e.g. Risk Index heatmap) — does not filter events by itself. */
  overlayOnly?: boolean;
}

export const LAYER_GROUPS: LayerGroup[] = [
  { id: "breaking_news", label: "Breaking News", providers: ["gnews", "gdelt", "rss", "supabase_intelligence", "acled"], defaultEnabled: true },
  { id: "earthquakes", label: "Earthquakes", providers: ["usgs"], defaultEnabled: true },
  { id: "wildfires", label: "Wildfires", providers: ["gdacs", "nasa_firms", "nasa_eonet"], subCategories: ["wildfire"], defaultEnabled: true },
  { id: "floods", label: "Floods", providers: ["gdacs", "nasa_eonet"], subCategories: ["flood"], defaultEnabled: false },
  { id: "storms", label: "Storms", providers: ["gdacs", "nasa_eonet"], subCategories: ["storm"], defaultEnabled: false },
  { id: "weather_alerts", label: "Weather Alerts", providers: ["openweather"], defaultEnabled: true },
  { id: "volcanoes", label: "Volcanoes", providers: ["gdacs", "nasa_eonet"], subCategories: ["volcano"], defaultEnabled: false },
  { id: "humanitarian", label: "Humanitarian Crises", providers: ["reliefweb"], defaultEnabled: false },
  { id: "economic", label: "Economic Indicators", providers: ["world_bank"], subCategories: ["gdp_per_capita"], defaultEnabled: false },
  { id: "population", label: "Population", providers: ["world_bank"], subCategories: ["population"], defaultEnabled: false },
  { id: "energy", label: "Energy", providers: ["world_bank"], subCategories: ["energy_use"], defaultEnabled: false },
  { id: "technology", label: "Technology", providers: ["gnews", "gdelt", "rss"], categories: ["technology"], defaultEnabled: false },
  { id: "cyber", label: "Cyber", providers: ["gnews", "gdelt", "rss"], categories: ["cyber"], defaultEnabled: false },
  { id: "health", label: "Health", providers: ["gnews", "gdelt", "rss", "reliefweb"], categories: ["health"], defaultEnabled: false },
  { id: "risk_index", label: "Risk Index", providers: [], overlayOnly: true, defaultEnabled: false },
  { id: "capitals", label: "Capitals", providers: ["rest_countries"], defaultEnabled: true },
  { id: "saved_alerts", label: "Saved alerts", providers: ["supabase_alerts"], defaultEnabled: true },
];

export const DEFAULT_ENABLED_LAYER_GROUPS: string[] = LAYER_GROUPS.filter((g) => g.defaultEnabled !== false).map((g) => g.id);

/** Flattened, de-duplicated provider list required to fetch every currently-enabled layer (used to scope EventEngine.loadAll). */
export function providerIdsForLayerGroups(enabledGroupIds: string[]): GlobalEventProvider[] | undefined {
  if (enabledGroupIds.length >= LAYER_GROUPS.length) return undefined; // everything enabled = no filter
  const providers = new Set<GlobalEventProvider>();
  for (const group of LAYER_GROUPS) {
    if (enabledGroupIds.includes(group.id)) group.providers.forEach((p) => providers.add(p));
  }
  return [...providers];
}

/** @deprecated use `providerIdsForLayerGroups` — kept as an alias so any lingering imports keep compiling. */
export const providersForLayerGroups = providerIdsForLayerGroups;

function eventMatchesGroup(event: GlobalEvent, group: LayerGroup): boolean {
  if (group.overlayOnly) return false; // never contributes to event-level filtering
  if (!group.providers.includes(event.provider)) return false;
  if (group.categories?.length && !group.categories.includes(event.category)) return false;
  if (group.subCategories?.length && !group.subCategories.includes(event.subCategory ?? "")) return false;
  return true;
}

/**
 * Precise event-level layer filter: an event passes if it matches ANY
 * currently-enabled layer group (providers + optional category/subCategory
 * narrowing). This is what actually determines what's drawn on the map —
 * `providerIdsForLayerGroups` only controls what gets *fetched*.
 */
export function filterEventsByLayerGroups(events: GlobalEvent[], enabledGroupIds: string[]): GlobalEvent[] {
  const enabledGroups = LAYER_GROUPS.filter((g) => enabledGroupIds.includes(g.id) && !g.overlayOnly);
  if (enabledGroups.length === 0) return [];
  return events.filter((event) => enabledGroups.some((group) => eventMatchesGroup(event, group)));
}

/** The 12 map category layers requested for InfoEducație — every category button is wired to a real filter. */
export const MAP_CATEGORIES: { id: GlobalEventCategory; label: string }[] = [
  { id: "military", label: "Military" },
  { id: "economy", label: "Economy" },
  { id: "technology", label: "Technology" },
  { id: "energy", label: "Energy" },
  { id: "climate", label: "Climate" },
  { id: "cyber", label: "Cyber" },
  { id: "health", label: "Health" },
  { id: "geopolitics", label: "Politics" },
  { id: "earthquake", label: "Earthquakes" },
  { id: "weather", label: "Weather" },
  { id: "disaster", label: "Disasters" },
  { id: "general", label: "General" },
];

export function categoryCountsFromGlobal(events: GlobalEvent[]): Partial<Record<GlobalEventCategory, number>> {
  const r: Partial<Record<GlobalEventCategory, number>> = {};
  for (const e of events) r[e.category] = (r[e.category] ?? 0) + 1;
  return r;
}
