/**
 * Adapts the Alert System's `RiskHeatmap` (country/coordinate risk density,
 * already used by the Global Alert Center) into the same GeoJSON shape the
 * map's native heatmap layer consumes — powering the map's "Risk Index"
 * intelligence layer without duplicating any risk-scoring logic.
 */
import { buildRiskHeatmap } from "@/alert-system/heatmap/heatmapEngine";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { HeatmapFeatureCollection, HeatmapPointFeature } from "./heatmapData";

export function buildRiskIndexGeoJSON(events: GlobalEvent[]): HeatmapFeatureCollection {
  const heatmap = buildRiskHeatmap(events);

  const features: HeatmapPointFeature[] = heatmap.cells
    .filter((cell) => cell.lat !== 0 || cell.lng !== 0)
    .map((cell, i) => ({
      type: "Feature",
      properties: { weight: Math.max(0.05, cell.intensity), id: `risk-${i}-${cell.countryOrRegion}` },
      geometry: { type: "Point", coordinates: [cell.lng, cell.lat] },
    }));

  return { type: "FeatureCollection", features };
}
