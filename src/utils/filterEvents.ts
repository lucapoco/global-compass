import type { GlobalEvent, GlobalEventCategory, GlobalEventProvider } from "@/domain/models/GlobalEvent";

/**
 * UI-facing "layer" groups shown as toggles on the map (Earthquakes / Intelligence /
 * Saved alerts / Weather / Capitals). Each maps to one or more `GlobalEventProvider`s
 * so the underlying EventEngine filter stays a flat provider list.
 */
export interface LayerGroup {
  id: string;
  label: string;
  providers: GlobalEventProvider[];
}

export const LAYER_GROUPS: LayerGroup[] = [
  { id: "earthquakes", label: "Earthquakes", providers: ["usgs"] },
  { id: "intelligence", label: "Intelligence", providers: ["gnews", "supabase_intelligence"] },
  { id: "saved_alerts", label: "Saved alerts", providers: ["supabase_alerts"] },
  { id: "weather", label: "Weather", providers: ["openweather"] },
  { id: "capitals", label: "Capitals", providers: ["rest_countries"] },
];

export const DEFAULT_ENABLED_LAYER_GROUPS: string[] = LAYER_GROUPS.map((g) => g.id);

/** Flattens the enabled layer group ids into the provider list EventFilterOptions expects. */
export function providersForLayerGroups(enabledGroupIds: string[]): GlobalEventProvider[] | undefined {
  if (enabledGroupIds.length >= LAYER_GROUPS.length) return undefined; // all enabled = no filter
  const providers = new Set<GlobalEventProvider>();
  for (const group of LAYER_GROUPS) {
    if (enabledGroupIds.includes(group.id)) group.providers.forEach((p) => providers.add(p));
  }
  return [...providers];
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
