/**
 * Event Graph Builder
 *
 * Constructs a typed IntelligenceGraph from a set of GlobalEvents by:
 *   1. Running the correlation engine to produce edges
 *   2. Building GraphNode entries with degree + centrality scores
 *   3. Assembling clusters (via the cluster engine)
 *   4. Building the unified timeline
 *
 * The graph is immutable once built. To update, call `buildGraph()` again
 * with a fresh event set. The correlation engine has its own memo cache so
 * repeated builds over the same events are fast.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GRAPH ANALYTICS
 * ─────────────────────────────────────────────────────────────────────────
 * Degree centrality:
 *   degree(v) = number of edges incident to v
 *
 * Weighted centrality score (0–100):
 *   centralityScore = 50 × (degree / maxDegree)
 *                   + 50 × (avgEdgeConfidence / 100)
 *
 * Hub detection:
 *   isHub = degree > 3 AND centralityScore > 60
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { correlate, type CorrelationResult } from "../correlation/correlationEngine";
import type { CorrelationEngineConfig } from "../correlation/types";
import { buildClusters } from "../clusters/clusterEngine";
import { buildTimeline } from "../timeline/timelineEngine";
import type { IntelligenceGraph, GraphNode } from "./types";

// ─── Node builder ─────────────────────────────────────────────────────────────

function buildNodes(
  events: GlobalEvent[],
  correlation: CorrelationResult,
  clusterMembership: Map<string, string[]>,
): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();

  const maxDegree = Math.max(
    1,
    ...Array.from(correlation.edgesByEventId.values()).map((e) => e.length),
  );

  for (const event of events) {
    const edges = correlation.edgesByEventId.get(event.id) ?? [];
    const degree = edges.length;

    // Weighted centrality: degree contribution + average edge confidence
    const avgConf =
      degree > 0
        ? edges.reduce((s, e) => s + e.confidence, 0) / degree
        : 0;
    const centralityScore = Math.round(
      50 * (degree / maxDegree) + 50 * (avgConf / 100),
    );

    const isHub = degree > 3 && centralityScore > 60;

    nodes.set(event.id, {
      event,
      clusterIds: clusterMembership.get(event.id) ?? [],
      degree,
      centralityScore,
      isHub,
    });
  }

  return nodes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BuildGraphOptions {
  correlationConfig?: Partial<CorrelationEngineConfig>;
  /** Include a timeline with this preset window. Defaults to "7d". */
  timelineWindow?: "24h" | "7d" | "30d";
}

/**
 * Build a complete IntelligenceGraph from a set of GlobalEvents.
 *
 * Typical usage:
 *   const graph = buildGraph(await eventEngine.loadAll());
 *   // graph.nodes — all events as graph nodes with centrality
 *   // graph.edges — all correlation edges with explanations
 *   // graph.clusters — intelligence clusters
 *   // graph.timeline — unified timeline groups
 */
export function buildGraph(
  events: GlobalEvent[],
  options: BuildGraphOptions = {},
): IntelligenceGraph {
  const t0 = Date.now();

  // ── 1. Correlation ───────────────────────────────────────────────────────
  const correlation = correlate(events, options.correlationConfig);

  // ── 2. Clusters ──────────────────────────────────────────────────────────
  const { clusters, membership } = buildClusters(events, correlation.edges);

  // ── 3. Nodes ─────────────────────────────────────────────────────────────
  const nodes = buildNodes(events, correlation, membership);

  // ── 4. Timeline ──────────────────────────────────────────────────────────
  const windowMs =
    options.timelineWindow === "24h" ? 24 * 3_600_000 :
    options.timelineWindow === "30d" ? 30 * 86_400_000 :
    7 * 86_400_000; // default 7d

  const timeline = buildTimeline(events, clusters, windowMs);

  // ── 5. Stats ─────────────────────────────────────────────────────────────
  const hubCount = Array.from(nodes.values()).filter((n) => n.isHub).length;

  return {
    nodes,
    edges: correlation.edges,
    clusters,
    timeline,
    generatedAt: new Date().toISOString(),
    stats: {
      eventCount: events.length,
      edgeCount: correlation.edges.length,
      clusterCount: clusters.length,
      hubCount,
      processingMs: Date.now() - t0,
    },
  };
}

// ─── Graph utilities ──────────────────────────────────────────────────────────

/** Return all edges connected to a specific event, sorted by priority. */
export function getEventEdges(
  graph: IntelligenceGraph,
  eventId: string,
): import("../correlation/types").CorrelationEdge[] {
  return graph.edges
    .filter((e) => e.sourceId === eventId || e.targetId === eventId)
    .sort((a, b) => b.priority - a.priority);
}

/** Return the cluster(s) an event belongs to. */
export function getEventClusters(
  graph: IntelligenceGraph,
  eventId: string,
): IntelligenceGraph["clusters"] {
  const node = graph.nodes.get(eventId);
  if (!node?.clusterIds.length) return [];
  const clusterSet = new Set(node.clusterIds);
  return graph.clusters.filter((c) => clusterSet.has(c.id));
}

/** Return all events connected to a specific event (directly, via edges). */
export function getConnectedEvents(
  graph: IntelligenceGraph,
  eventId: string,
): GlobalEvent[] {
  const edges = getEventEdges(graph, eventId);
  const ids = new Set(
    edges.flatMap((e) => [e.sourceId, e.targetId]).filter((id) => id !== eventId),
  );
  return Array.from(ids)
    .map((id) => graph.nodes.get(id)?.event)
    .filter((e): e is GlobalEvent => !!e);
}
