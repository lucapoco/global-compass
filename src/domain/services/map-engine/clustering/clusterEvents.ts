import type { GlobalEvent, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { hasCoordinates } from "@/domain/utils/geo";
import type { EventCluster } from "../types";

const SEVERITY_SCORE: Record<GlobalEventSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SCORE_TO_SEVERITY: [number, GlobalEventSeverity][] = [
  [3.5, "critical"],
  [2.5, "high"],
  [1.5, "medium"],
];

function severityFromAverage(avg: number): GlobalEventSeverity {
  for (const [threshold, label] of SCORE_TO_SEVERITY) if (avg >= threshold) return label;
  return "low";
}

/** Grid cell size (degrees) shrinks as zoom increases so clusters dissolve smoothly on zoom-in. */
export function cellSizeDegForZoom(zoom: number): number {
  const MAX_CELL_DEG = 40;
  const MIN_CELL_DEG = 0.4;
  const size = 60 / Math.pow(1.6, zoom);
  return Math.min(MAX_CELL_DEG, Math.max(MIN_CELL_DEG, size));
}

/** Above this zoom, clustering is effectively disabled (every event renders individually). */
export const CLUSTER_DISABLE_ZOOM = 10;

/**
 * Zoom-aware grid clustering. ~1000 world-spread events at zoom 1-2 collapse into a
 * few dozen clusters; zooming in shrinks the grid cell so clusters progressively
 * dissolve into individual events. Deterministic, no external clustering dependency.
 */
export function clusterEvents(events: GlobalEvent[], zoom: number): EventCluster[] {
  const withCoords = events.filter((e) => hasCoordinates(e.coordinates));
  if (!withCoords.length) return [];

  if (zoom >= CLUSTER_DISABLE_ZOOM) {
    return withCoords.map((e) => soleCluster(e));
  }

  const cellDeg = cellSizeDegForZoom(zoom);
  const buckets = new Map<string, GlobalEvent[]>();

  for (const event of withCoords) {
    const { lat, lng } = event.coordinates!;
    const key = `${Math.floor(lat / cellDeg)}:${Math.floor(lng / cellDeg)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(event);
    else buckets.set(key, [event]);
  }

  const clusters: EventCluster[] = [];
  for (const [key, bucketEvents] of buckets.entries()) {
    if (bucketEvents.length === 1) {
      clusters.push(soleCluster(bucketEvents[0]));
      continue;
    }

    let sumLat = 0;
    let sumLng = 0;
    let sumSeverity = 0;
    let sumRisk = 0;
    const categoryCounts = new Map<string, number>();

    for (const e of bucketEvents) {
      sumLat += e.coordinates!.lat;
      sumLng += e.coordinates!.lng;
      sumSeverity += SEVERITY_SCORE[e.severity];
      sumRisk += e.riskScore;
      categoryCounts.set(e.category, (categoryCounts.get(e.category) ?? 0) + 1);
    }

    let dominantCategory = bucketEvents[0].category;
    let maxCount = 0;
    for (const [cat, count] of categoryCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = cat as GlobalEvent["category"];
      }
    }

    const avgSeverityScore = sumSeverity / bucketEvents.length;
    clusters.push({
      id: `cluster-${key}`,
      lat: sumLat / bucketEvents.length,
      lng: sumLng / bucketEvents.length,
      count: bucketEvents.length,
      dominantCategory,
      averageSeverity: severityFromAverage(avgSeverityScore),
      averageSeverityScore: avgSeverityScore,
      averageRiskScore: Math.round(sumRisk / bucketEvents.length),
      eventIds: bucketEvents.map((e) => e.id),
    });
  }

  return clusters;
}

function soleCluster(event: GlobalEvent): EventCluster {
  return {
    id: `single-${event.id}`,
    lat: event.coordinates!.lat,
    lng: event.coordinates!.lng,
    count: 1,
    dominantCategory: event.category,
    averageSeverity: event.severity,
    averageSeverityScore: SEVERITY_SCORE[event.severity],
    averageRiskScore: event.riskScore,
    eventIds: [event.id],
    soleEvent: event,
  };
}
