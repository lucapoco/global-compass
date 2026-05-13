import type { MapEvent, IntelligenceCategory } from "@/types";
import type { LayerKey, SeverityKey } from "@/components/map/MapFilters";

export type EventCategory = IntelligenceCategory | "earthquake" | "weather";

export interface MapFilters {
  search: string;
  layers: Record<LayerKey, boolean>;
  severity: SeverityKey;
  highSeverityOnly: boolean;
  /** Empty set = no category filter (all). */
  categories: Set<EventCategory>;
}

/** Derives the canonical category for filtering from a MapEvent. */
export function eventCategory(e: MapEvent): EventCategory {
  if (e.type === "earthquake") return "earthquake";
  if (e.type === "weather") return "weather";
  return (e.category ?? "general") as EventCategory;
}

export function filterMapEvents(events: MapEvent[], f: MapFilters): MapEvent[] {
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    if (!f.layers[e.type]) return false;
    if (f.highSeverityOnly && !["High", "Critical"].includes(e.severity ?? "")) return false;
    if (f.severity !== "all" && e.severity !== f.severity) return false;
    if (f.categories.size > 0 && !f.categories.has(eventCategory(e))) return false;
    if (q) {
      const blob = `${e.title} ${e.description ?? ""} ${e.category ?? ""} ${e.type}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

export function categoryCounts(events: MapEvent[]): Record<EventCategory, number> {
  const r: Record<string, number> = {};
  for (const e of events) {
    const c = eventCategory(e);
    r[c] = (r[c] ?? 0) + 1;
  }
  return r as Record<EventCategory, number>;
}
