/**
 * Global Risk Heatmap Engine
 *
 * Builds a dynamic risk heatmap from current GlobalEvents, suitable for
 * overlaying on the Globe/Map. Each cell represents an event location (or
 * country centroid when coordinates are missing) with an intensity score
 * derived from nearby event density and severity.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTENSITY FORMULA
 * ─────────────────────────────────────────────────────────────────────────
 *   intensity = normalize( Σ (event.riskScore × severityWeight) )
 *
 * Cells are grouped by country (or by rounded coordinate bucket when no
 * country is available) to avoid one heatmap point per single event.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { HeatmapCell, RiskHeatmap } from "../types";

const SEVERITY_WEIGHT: Record<GlobalEvent["severity"], number> = {
  critical: 1.5,
  high: 1.2,
  medium: 1.0,
  low: 0.6,
};

// ─── Country centroid approximation (reuse coordinates from events when present) ──

function bucketKey(event: GlobalEvent): string {
  if (event.country) return `country:${event.country.toLowerCase()}`;
  if (event.coordinates) {
    const lat = Math.round(event.coordinates.lat / 5) * 5;
    const lng = Math.round(event.coordinates.lng / 5) * 5;
    return `coord:${lat}:${lng}`;
  }
  return "unknown";
}

function trendForEvents(events: GlobalEvent[]): HeatmapCell["trend"] {
  if (events.length < 4) return "stable";
  const now = Date.now();
  const recent = events.filter((e) => now - new Date(e.timestamp).getTime() <= 24 * 3_600_000);
  const older = events.filter((e) => now - new Date(e.timestamp).getTime() > 24 * 3_600_000);
  if (older.length === 0) return recent.length > 0 ? "up" : "stable";

  const recentRate = recent.length;
  const olderRate = older.length / Math.max(1, (7 * 24) / 24); // per-day rate over the remaining window
  if (recentRate > olderRate * 1.3) return "up";
  if (recentRate < olderRate * 0.7) return "down";
  return "stable";
}

export function buildRiskHeatmap(events: GlobalEvent[]): RiskHeatmap {
  const buckets = new Map<string, GlobalEvent[]>();
  for (const e of events) {
    const key = bucketKey(e);
    if (key === "unknown") continue;
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }

  const rawCells: Array<Omit<HeatmapCell, "intensity">> = [];
  const rawScores: number[] = [];

  for (const [, bucketEvents] of buckets) {
    const withCoords = bucketEvents.find((e) => e.coordinates);
    const lat = withCoords?.coordinates?.lat ?? 0;
    const lng = withCoords?.coordinates?.lng ?? 0;
    const countryOrRegion = bucketEvents[0].country ?? "Unclassified";

    const score = bucketEvents.reduce(
      (s, e) => s + e.riskScore * SEVERITY_WEIGHT[e.severity],
      0,
    );

    const avgRisk = Math.round(bucketEvents.reduce((s, e) => s + e.riskScore, 0) / bucketEvents.length);

    rawCells.push({
      lat, lng, countryOrRegion,
      eventCount: bucketEvents.length,
      riskScore: avgRisk,
      trend: trendForEvents(bucketEvents),
    });
    rawScores.push(score);
  }

  const maxScore = Math.max(1, ...rawScores);

  const cells: HeatmapCell[] = rawCells.map((cell, i) => ({
    ...cell,
    intensity: Math.round((rawScores[i] / maxScore) * 100) / 100,
  }));

  return {
    cells: cells.sort((a, b) => b.intensity - a.intensity),
    maxIntensity: 1,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Region-level aggregation (for compact overlays) ──────────────────────────

export function aggregateHeatmapByRegion(
  heatmap: RiskHeatmap,
  regionCountries: Record<string, string[]>,
): Array<{ region: string; avgIntensity: number; eventCount: number }> {
  const results: Array<{ region: string; avgIntensity: number; eventCount: number }> = [];

  for (const [region, countries] of Object.entries(regionCountries)) {
    const cells = heatmap.cells.filter((c) =>
      countries.some((country) => country.toLowerCase() === c.countryOrRegion.toLowerCase()),
    );
    if (cells.length === 0) continue;

    results.push({
      region,
      avgIntensity: Math.round((cells.reduce((s, c) => s + c.intensity, 0) / cells.length) * 100) / 100,
      eventCount: cells.reduce((s, c) => s + c.eventCount, 0),
    });
  }

  return results.sort((a, b) => b.avgIntensity - a.avgIntensity);
}
