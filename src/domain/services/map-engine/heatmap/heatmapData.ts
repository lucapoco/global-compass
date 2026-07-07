import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { hasCoordinates } from "@/domain/utils/geo";
import { SEVERITY_WEIGHT } from "@/domain/services/event-engine/scoring";
import type { HeatmapWeightMode } from "../types";

export interface HeatmapPointFeature {
  type: "Feature";
  properties: { weight: number; id: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface HeatmapFeatureCollection {
  type: "FeatureCollection";
  features: HeatmapPointFeature[];
}

function weightFor(event: GlobalEvent, mode: HeatmapWeightMode): number {
  if (mode === "risk") return Math.max(0.05, event.riskScore / 100);
  if (mode === "severity") return Math.max(0.05, SEVERITY_WEIGHT[event.severity] / 100);
  return 1;
}

/**
 * Builds a GeoJSON point FeatureCollection weighted for density / risk / severity
 * heatmap rendering (consumed by a native Mapbox/MapLibre `heatmap` layer).
 */
export function buildHeatmapGeoJSON(events: GlobalEvent[], mode: HeatmapWeightMode = "density"): HeatmapFeatureCollection {
  const features: HeatmapPointFeature[] = events.filter((e) => hasCoordinates(e.coordinates)).map((e) => ({
    type: "Feature",
    properties: { weight: weightFor(e, mode), id: e.id },
    geometry: { type: "Point", coordinates: [e.coordinates!.lng, e.coordinates!.lat] },
  }));
  return { type: "FeatureCollection", features };
}
