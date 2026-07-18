/**
 * Event Correlation Engine — Public API
 *
 * The single import point for all intelligence graph, correlation,
 * clustering, timeline, replay, and analytics operations.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PRIMARY SERVICES (start here)
 * ─────────────────────────────────────────────────────────────────────────
 *   getGlobalEventGraph()         Full intelligence graph
 *   getCountryEventNetwork()      Per-country event network + cross-border
 *   getRiskEvolution()            Risk trend analytics
 *   getEventDetails()             Single event: edges + clusters + position
 *   snapshotNow()                 Persist current state
 *   invalidateGraphCache()        Force full graph rebuild
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REPLAY
 * ─────────────────────────────────────────────────────────────────────────
 *   createReplayState()           Initialize replay from events
 *   tickReplay()                  Advance cursor (call on each animation frame)
 *   getEventsAtCursor()           Events visible at current cursor
 *   replayControls                play / pause / stop / seekTo / setSpeed
 *   replayProgress()              0–1 progress fraction
 *   cursorLabel()                 Human-readable cursor time
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SNAPSHOTS
 * ─────────────────────────────────────────────────────────────────────────
 *   snapshotStore                 Snapshot store singleton
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GRAPH UTILITIES
 * ─────────────────────────────────────────────────────────────────────────
 *   buildGraph()                  Build IntelligenceGraph from events
 *   getEventEdges()               Edges for one event
 *   getConnectedEvents()          Events connected to one event
 *   getEventClusters()            Clusters containing one event
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIMELINE
 * ─────────────────────────────────────────────────────────────────────────
 *   buildTimeline()               Build TimelineGroup[] from events
 *   filterTimeline()              Narrow an existing timeline
 *   resolveTimelineWindow()       Convert window ID → {fromMs, toMs}
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ANALYTICS
 * ─────────────────────────────────────────────────────────────────────────
 *   buildRiskEvolutionReport()    Full risk analytics from events
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CORRELATION ENGINE (advanced usage)
 * ─────────────────────────────────────────────────────────────────────────
 *   correlate()                   Direct correlation of a set of events
 *   clearCorrelationCache()       Flush memo cache
 */

// ── Primary services ──────────────────────────────────────────────────────────
export {
  getGlobalEventGraph,
  getCountryEventNetwork,
  getRiskEvolution,
  getEventDetails,
  snapshotNow,
  invalidateGraphCache,
  type GraphOptions,
  type CountryEventNetwork,
  type EventDetails,
} from "./services/globalEventGraph";

// ── Graph builder ─────────────────────────────────────────────────────────────
export {
  buildGraph,
  getEventEdges,
  getConnectedEvents,
  getEventClusters,
  type BuildGraphOptions,
} from "./graph/eventGraph";

// ── Graph types ───────────────────────────────────────────────────────────────
export type {
  IntelligenceGraph,
  IntelligenceCluster,
  GraphNode,
  TimelineGroup,
  ReplayState,
  ReplaySnapshot,
  ReplayWindowId,
} from "./graph/types";

// ── Correlation engine ────────────────────────────────────────────────────────
export {
  correlate,
  clearCorrelationCache,
  type CorrelationResult,
} from "./correlation/correlationEngine";

export type {
  CorrelationEdge,
  CorrelationRelationship,
  CorrelationFactor,
  CorrelationEngineConfig,
  StrategyResult,
} from "./correlation/types";

export { DEFAULT_CORRELATION_CONFIG } from "./correlation/types";

// ── Explainability ────────────────────────────────────────────────────────────
export {
  computeConfidence,
  computeStrength,
  buildExplanation,
  strengthLabel,
  type StrengthLabel,
} from "./correlation/explainer";

// ── Cluster engine ────────────────────────────────────────────────────────────
export { buildClusters, type ClusterResult } from "./clusters/clusterEngine";

// ── Timeline ──────────────────────────────────────────────────────────────────
export {
  buildTimeline,
  filterTimeline,
  resolveTimelineWindow,
  type TimelineWindowId,
  type TimelineWindow,
} from "./timeline/timelineEngine";

// ── Replay ────────────────────────────────────────────────────────────────────
export {
  createReplayState,
  tickReplay,
  getEventsAtCursor,
  replayControls,
  replayProgress,
  cursorLabel,
  REPLAY_SPEEDS,
  type ReplaySpeed,
} from "./replay/replayEngine";

// ── Snapshot store ────────────────────────────────────────────────────────────
export { snapshotStore, SnapshotStore } from "./history/snapshotStore";

// ── Analytics ─────────────────────────────────────────────────────────────────
export {
  buildRiskEvolutionReport,
  type RiskEvolutionReport,
  type RiskSample,
  type CountryRiskProfile,
  type EscalationSignal,
} from "./analytics/riskEvolution";
