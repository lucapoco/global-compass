import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { hasCoordinates } from "@/domain/utils/geo";

export interface RelationLineFeature {
  type: "Feature";
  properties: { fromId: string; toId: string; toSeverity: string; toCategory: string };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface RelationLineFeatureCollection {
  type: "FeatureCollection";
  features: RelationLineFeature[];
}

/**
 * Builds connecting lines from a selected event to its correlated `relatedEvents`
 * (e.g. Earthquake -> nearby news -> related weather alert -> same region), for an
 * optional "relationship lines" map layer. Only pairs where both ends have coordinates
 * produce a line.
 */
export function buildRelatedEventLines(events: GlobalEvent[], selectedEventId: string): RelationLineFeatureCollection {
  const byId = new Map(events.map((e) => [e.id, e] as const));
  const selected = byId.get(selectedEventId);
  if (!selected || !hasCoordinates(selected.coordinates)) return { type: "FeatureCollection", features: [] };

  const features: RelationLineFeature[] = [];
  for (const relatedId of selected.relatedEvents) {
    const related = byId.get(relatedId);
    if (!related || !hasCoordinates(related.coordinates)) continue;
    features.push({
      type: "Feature",
      properties: {
        fromId: selected.id,
        toId: related.id,
        toSeverity: related.severity,
        toCategory: related.category,
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [selected.coordinates!.lng, selected.coordinates!.lat],
          [related.coordinates!.lng, related.coordinates!.lat],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
