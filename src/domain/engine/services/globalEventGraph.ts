/**
 * Global Event Graph Service
 *
 * The single entry point for all correlation/graph intelligence.
 * Future UI modules (Dashboard, Globe, Country Pages, AI, Reports, Analytics)
 * should call functions from this service — never the sub-engines directly.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MAIN FUNCTIONS
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   getGlobalEventGraph()
 *     Full intelligence graph: nodes, edges, clusters, timeline.
 *     Calls EventEngine → CorrelationEngine → ClusterEngine → Timeline.
 *
 *   getCountryEventNetwork(countryName)
 *     All events for one country + their internal correlations + related countries.
 *
 *   getRiskEvolution(windowId)
 *     Risk time-series, trend direction, escalation signals.
 *
 *   getEventDetails(eventId)
 *     Full event record + its edges + cluster membership + timeline position.
 *
 *   snapshotNow()
 *     Persist the current graph state to the snapshot store.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CACHING
 * ─────────────────────────────────────────────────────────────────────────
 * The graph is cached for `GRAPH_TTL_MS` (5 minutes). Correlation results
 * are memoized by event-pair key until `clearCorrelationCache()` is called.
 * A force refresh bypasses both layers.
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import { buildGraph, getEventEdges, getConnectedEvents } from "../graph/eventGraph";
import { buildRiskEvolutionReport } from "../analytics/riskEvolution";
import { snapshotStore } from "../history/snapshotStore";
import { clearCorrelationCache } from "../correlation/correlationEngine";
import type { IntelligenceGraph, ReplayWindowId } from "../graph/types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { RiskEvolutionReport } from "../analytics/riskEvolution";
import type { CorrelationEdge } from "../correlation/types";

// ─── Graph cache ──────────────────────────────────────────────────────────────

const GRAPH_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface GraphCacheEntry {
  graph: IntelligenceGraph;
  cachedAt: number;
}

let graphCache: GraphCacheEntry | null = null;

// ─── Options ──────────────────────────────────────────────────────────────────

export interface GraphOptions {
  /** Force a full reload from providers, bypassing all caches. */
  force?: boolean;
  /** Timeline window to include in the graph. Default "7d". */
  timelineWindow?: "24h" | "7d" | "30d";
  /** Auto-save a snapshot after building. Default false. */
  autoSnapshot?: boolean;
  /** Override window ID for snapshot. Default "7d". */
  snapshotWindow?: ReplayWindowId;
}

// ─── Main service functions ───────────────────────────────────────────────────

/**
 * Build and return the complete IntelligenceGraph.
 *
 * Calls the EventEngine to load all events, then runs correlation,
 * clustering, and timeline assembly. Result is cached for 5 minutes.
 *
 * The returned graph is the authoritative data source for:
 *   - Dashboard intelligence panels
 *   - Globe node/edge overlays
 *   - Country page event networks
 *   - Analytics risk evolution
 *   - AI report context
 */
export async function getGlobalEventGraph(options: GraphOptions = {}): Promise<IntelligenceGraph> {
  // Return cached graph if fresh
  if (!options.force && graphCache && Date.now() - graphCache.cachedAt < GRAPH_TTL_MS) {
    return graphCache.graph;
  }

  if (options.force) {
    clearCorrelationCache();
  }

  const events = await eventEngine.loadAll({ force: options.force });
  const graph = buildGraph(events, { timelineWindow: options.timelineWindow ?? "7d" });

  graphCache = { graph, cachedAt: Date.now() };

  if (options.autoSnapshot) {
    snapshotStore.save(
      events,
      graph.clusters,
      graph.edges.length,
      options.snapshotWindow ?? "7d",
    );
  }

  return graph;
}

// ─── Country event network ────────────────────────────────────────────────────

export interface CountryEventNetwork {
  countryName: string;
  events: GlobalEvent[];
  internalEdges: CorrelationEdge[];
  relatedCountries: Array<{
    country: string;
    sharedEdgeCount: number;
    highestSeverity: string;
  }>;
  clusterCount: number;
  riskScore: number;
}

/**
 * Return the event network for a single country, including cross-border connections.
 * Uses the cached global graph (rebuilds if stale).
 */
export async function getCountryEventNetwork(
  countryName: string,
): Promise<CountryEventNetwork> {
  const graph = await getGlobalEventGraph();

  const countryEvents = Array.from(graph.nodes.values())
    .map((n) => n.event)
    .filter((e) => e.country?.toLowerCase() === countryName.toLowerCase());

  const countryEventIds = new Set(countryEvents.map((e) => e.id));

  // Internal edges (both endpoints in this country)
  const internalEdges = graph.edges.filter(
    (e) => countryEventIds.has(e.sourceId) && countryEventIds.has(e.targetId),
  );

  // Cross-border edges (one endpoint in this country)
  const crossBorderEdges = graph.edges.filter(
    (e) =>
      (countryEventIds.has(e.sourceId) && !countryEventIds.has(e.targetId)) ||
      (!countryEventIds.has(e.sourceId) && countryEventIds.has(e.targetId)),
  );

  // Related countries from cross-border edges
  const relatedCountryMap = new Map<string, { count: number; maxSev: string }>();
  for (const edge of crossBorderEdges) {
    const foreignId = countryEventIds.has(edge.sourceId) ? edge.targetId : edge.sourceId;
    const foreignEvent = graph.nodes.get(foreignId)?.event;
    if (!foreignEvent?.country || foreignEvent.country.toLowerCase() === countryName.toLowerCase()) continue;

    const existing = relatedCountryMap.get(foreignEvent.country) ?? {
      count: 0,
      maxSev: "low",
    };
    const sevOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    const newSev =
      sevOrder[foreignEvent.severity as keyof typeof sevOrder] >
      sevOrder[existing.maxSev as keyof typeof sevOrder]
        ? foreignEvent.severity
        : existing.maxSev;

    relatedCountryMap.set(foreignEvent.country, { count: existing.count + 1, maxSev: newSev });
  }

  const relatedCountries = [...relatedCountryMap.entries()]
    .map(([country, { count, maxSev }]) => ({
      country,
      sharedEdgeCount: count,
      highestSeverity: maxSev,
    }))
    .sort((a, b) => b.sharedEdgeCount - a.sharedEdgeCount)
    .slice(0, 10);

  const clusterCount = graph.clusters.filter(
    (c) => c.countries.some((co) => co.toLowerCase() === countryName.toLowerCase()),
  ).length;

  const riskScore =
    countryEvents.length > 0
      ? Math.round(countryEvents.reduce((s, e) => s + e.riskScore, 0) / countryEvents.length)
      : 0;

  return {
    countryName,
    events: countryEvents,
    internalEdges,
    relatedCountries,
    clusterCount,
    riskScore,
  };
}

// ─── Risk evolution ───────────────────────────────────────────────────────────

const WINDOW_MS: Record<Exclude<ReplayWindowId, "custom">, number> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
};

export async function getRiskEvolution(
  windowId: Exclude<ReplayWindowId, "custom"> = "7d",
): Promise<RiskEvolutionReport> {
  const events = eventEngine.getLastLoaded();
  const pool = events.length ? events : await eventEngine.loadAll();
  return buildRiskEvolutionReport(pool, WINDOW_MS[windowId]);
}

// ─── Event details ────────────────────────────────────────────────────────────

export interface EventDetails {
  event: GlobalEvent;
  edges: CorrelationEdge[];
  connectedEvents: GlobalEvent[];
  clusterTitles: string[];
  timelinePosition: number;  // 0–1 within the full graph timeline
}

export async function getEventDetails(eventId: string): Promise<EventDetails | null> {
  const graph = await getGlobalEventGraph();
  const node = graph.nodes.get(eventId);
  if (!node) return null;

  const edges = getEventEdges(graph, eventId);
  const connectedEvents = getConnectedEvents(graph, eventId);
  const clusterTitles = node.clusterIds
    .map((cid) => graph.clusters.find((c) => c.id === cid)?.title)
    .filter((t): t is string => !!t);

  // Timeline position
  const allTimestamps = graph.timeline.flatMap((g) =>
    g.events.map((e) => new Date(e.timestamp).getTime()),
  );
  const eventMs = new Date(node.event.timestamp).getTime();
  const minT = Math.min(...allTimestamps, eventMs);
  const maxT = Math.max(...allTimestamps, eventMs);
  const timelinePosition =
    maxT > minT ? (eventMs - minT) / (maxT - minT) : 0.5;

  return { event: node.event, edges, connectedEvents, clusterTitles, timelinePosition };
}

// ─── Snapshot management ──────────────────────────────────────────────────────

export async function snapshotNow(
  windowId: ReplayWindowId = "7d",
  force = false,
): Promise<string | null> {
  const graph = graphCache?.graph;
  if (!graph) return null;

  const events = eventEngine.getLastLoaded();
  const snapshot = snapshotStore.save(events, graph.clusters, graph.edges.length, windowId, force);
  return snapshot?.id ?? null;
}

/** Invalidate the graph cache (forces full rebuild on next call). */
export function invalidateGraphCache(): void {
  graphCache = null;
  clearCorrelationCache();
}
