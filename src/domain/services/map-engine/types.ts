import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";

export interface MapViewport {
  center: [number, number]; // [lng, lat]
  zoom: number;
}

export interface EventCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  dominantCategory: GlobalEventCategory;
  averageSeverity: GlobalEventSeverity;
  averageSeverityScore: number; // 1 (low) - 4 (critical)
  averageRiskScore: number;
  eventIds: string[];
  /** The single wrapped event when count === 1 — lets the renderer skip cluster styling. */
  soleEvent?: GlobalEvent;
}

export type HeatmapWeightMode = "density" | "risk" | "severity";
export type MapVisualizationMode = "markers" | "heatmap" | "both";

export type TimelineRangeId = "6h" | "24h" | "48h" | "7d" | "30d" | "custom";

export interface TimelineRange {
  id: TimelineRangeId;
  /** Milliseconds of lookback from "now" — undefined for "custom". */
  windowMs?: number;
  /** Only used when id === "custom". */
  fromMs?: number;
  toMs?: number;
}

export interface ReplayState {
  isPlaying: boolean;
  cursorMs: number;
  startMs: number;
  endMs: number;
  /** Playback speed multiplier — how many real ms of event-time pass per tick-second. */
  speed: number;
}
