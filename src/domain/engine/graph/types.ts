/**
 * Intelligence Graph — Type Definitions
 *
 * Every GlobalEvent becomes a node. Every correlation becomes a directed edge.
 * Clusters group densely-connected nodes into named intelligence units.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { CorrelationEdge } from "../correlation/types";

// ─── Graph node ───────────────────────────────────────────────────────────────

export interface GraphNode {
  /** The event this node represents. */
  event: GlobalEvent;
  /** IDs of clusters this node belongs to. */
  clusterIds: string[];
  /** Number of edges connected to this node. */
  degree: number;
  /**
   * Centrality score (0–100).
   * Derived from degree + average edge confidence.
   * High-centrality nodes are "hub events" — they connect many others.
   */
  centralityScore: number;
  /** True if this node is a hub (degree > 3 AND centralityScore > 60). */
  isHub: boolean;
}

// ─── Intelligence cluster ─────────────────────────────────────────────────────

export interface IntelligenceCluster {
  id: string;
  /** Auto-generated title, e.g. "Japan Earthquake Crisis" */
  title: string;
  /** One-sentence summary of the cluster. */
  summary: string;
  events: GlobalEvent[];
  countries: string[];
  categories: GlobalEventCategory[];
  highestSeverity: GlobalEventSeverity;
  /** Max riskScore among cluster events. */
  riskScore: number;
  /** Mean riskScore across cluster events. */
  avgRiskScore: number;
  /** Internal edges (both endpoints within the cluster). */
  internalEdges: CorrelationEdge[];
  timeRange: {
    startMs: number;
    endMs: number;
    startIso: string;
    endIso: string;
  };
  /** Geographic centroid (null if events lack coordinates). */
  centerCoordinates: { lat: number; lng: number } | null;
  size: number;
}

// ─── Timeline event ───────────────────────────────────────────────────────────

export interface TimelineGroup {
  id: string;
  /** Period label, e.g. "Today", "Yesterday", "Mar 15", "Last Week". */
  label: string;
  periodStartIso: string;
  periodEndIso: string;
  events: GlobalEvent[];
  countries: string[];
  categories: GlobalEventCategory[];
  highestSeverity: GlobalEventSeverity;
  /** Cluster ID if all events in this group belong to one cluster. */
  clusterId?: string;
}

// ─── Replay ───────────────────────────────────────────────────────────────────

export type ReplayWindowId = "24h" | "7d" | "30d" | "custom";

export interface ReplayState {
  isPlaying: boolean;
  cursorMs: number;
  startMs: number;
  endMs: number;
  /** Playback speed multiplier (0.5 | 1 | 2 | 4 | 8). */
  speed: number;
  /**
   * How large a sliding window of events to show at each cursor position.
   * 0 = show all events up to cursor (accumulating mode).
   */
  windowMs: number;
}

export interface ReplaySnapshot {
  id: string;
  capturedAt: string;
  windowId: ReplayWindowId;
  windowLabel: string;
  events: GlobalEvent[];
  clusterSummaries: Array<{
    id: string;
    title: string;
    eventCount: number;
    highestSeverity: GlobalEventSeverity;
    riskScore: number;
    countries: string[];
  }>;
  globalRiskScore: number;
  topCountries: Array<{ country: string; score: number }>;
  edgeCount: number;
}

// ─── Full intelligence graph ──────────────────────────────────────────────────

export interface IntelligenceGraph {
  nodes: Map<string, GraphNode>;
  edges: CorrelationEdge[];
  clusters: IntelligenceCluster[];
  timeline: TimelineGroup[];
  /** ISO timestamp when this graph was assembled. */
  generatedAt: string;
  stats: {
    eventCount: number;
    edgeCount: number;
    clusterCount: number;
    hubCount: number;
    processingMs: number;
  };
}
