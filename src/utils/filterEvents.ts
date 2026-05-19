import type { EventCategory, EventLayer, EventSeverity, GlobalEvent } from "@/types";

export type { EventCategory, EventLayer, EventSeverity };

/** Single filter pipeline for the Live World Map. */
export type MapFilters = {
  searchQuery: string;
  enabledLayers: EventLayer[];
  selectedSeverity: EventSeverity | "all";
  selectedCategories: EventCategory[];
  highSeverityOnly: boolean;
};

const ALL_LAYERS: EventLayer[] = ["earthquakes", "intelligence", "saved_alerts", "weather", "capitals"];

export const DEFAULT_ENABLED_LAYERS: EventLayer[] = [...ALL_LAYERS];

/** 1) layers 2) high-only 3) specific severity 4) categories 5) search */
export function filterGlobalEvents(events: GlobalEvent[], f: MapFilters): GlobalEvent[] {
  const q = f.searchQuery.trim().toLowerCase();
  return events.filter((e) => {
    if (!f.enabledLayers.includes(e.layer)) return false;
    if (f.highSeverityOnly && !["high", "critical"].includes(e.severity)) return false;
    if (f.selectedSeverity !== "all" && e.severity !== f.selectedSeverity) return false;
    if (f.selectedCategories.length > 0 && !f.selectedCategories.includes(e.category)) return false;
    if (q) {
      const blob = [
        e.title,
        e.description ?? "",
        e.country ?? "",
        e.location ?? "",
        e.source,
        e.category,
        e.severity,
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

export function categoryCountsFromGlobal(events: GlobalEvent[]): Partial<Record<EventCategory, number>> {
  const r: Partial<Record<EventCategory, number>> = {};
  for (const e of events) {
    r[e.category] = (r[e.category] ?? 0) + 1;
  }
  return r;
}

export function allLayersEnabled(enabled: EventLayer[]): boolean {
  return ALL_LAYERS.every((l) => enabled.includes(l));
}

export function missingLayers(enabled: EventLayer[]): EventLayer[] {
  return ALL_LAYERS.filter((l) => !enabled.includes(l));
}
