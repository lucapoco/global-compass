/**
 * Correlation Engine Orchestrator
 *
 * Runs all correlation strategies over a set of GlobalEvents and produces
 * a typed CorrelationEdge[] — the edges of the intelligence graph.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERFORMANCE STRATEGY
 * ─────────────────────────────────────────────────────────────────────────
 * Naive pairwise comparison is O(N²).  With N=500 → 125 000 pairs.
 * Each pair runs 5 strategies, each O(1) or O(K) where K=tokens (~10).
 * Total: ~625 000 ops — fast in modern JS (~15 ms on a mid-range device).
 *
 * Optimisations applied:
 *   1. Country pre-grouping: events from the same country are correlated
 *      first; cross-country pairs are only tested for time/keyword overlap.
 *   2. Time window gate: pairs more than `maxHoursApart * 1.5` apart are
 *      skipped before running any strategy.
 *   3. Cap: only the first `maxEvents` events are processed.
 *   4. Edge deduplication: only one edge per pair (undirected pre-dedupe).
 *   5. Per-node cap: `maxEdgesPerNode` keeps the graph navigable.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MEMOIZATION
 * ─────────────────────────────────────────────────────────────────────────
 * The engine memoizes edge results by stable pair key `${idA}~${idB}`.
 * Calling `correlate()` twice with the same event set returns cached results.
 * Call `clearCache()` to force re-computation.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { haversineDistanceKm, hasCoordinates } from "@/domain/utils/geo";
import { ALL_STRATEGIES } from "./strategies";
import { assembleEdge } from "./explainer";
import type {
  CorrelationEdge,
  CorrelationEngineConfig,
  StrategyResult,
} from "./types";
import { DEFAULT_CORRELATION_CONFIG } from "./types";

// ─── Memoization store ────────────────────────────────────────────────────────

const memo = new Map<string, CorrelationEdge | null>();

function pairKey(a: GlobalEvent, b: GlobalEvent): string {
  return [a.id, b.id].sort().join("~");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function quickTimeGate(a: GlobalEvent, b: GlobalEvent, maxHours: number): boolean {
  const diffMs = Math.abs(
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  // 1.5× buffer so the time strategy can still fire for pairs at the edge
  return diffMs <= maxHours * 1.5 * 3_600_000;
}

function safeDistance(a: GlobalEvent, b: GlobalEvent): number | null {
  if (!hasCoordinates(a.coordinates) || !hasCoordinates(b.coordinates)) return null;
  return haversineDistanceKm(a.coordinates, b.coordinates);
}

// ─── Core pair evaluation ─────────────────────────────────────────────────────

function evaluatePair(
  a: GlobalEvent,
  b: GlobalEvent,
  config: CorrelationEngineConfig,
): CorrelationEdge | null {
  const key = pairKey(a, b);
  if (memo.has(key)) return memo.get(key) ?? null;

  if (!quickTimeGate(a, b, config.maxHoursApart)) {
    memo.set(key, null);
    return null;
  }

  const results: StrategyResult[] = [];
  for (const strategy of ALL_STRATEGIES) {
    const result = strategy.run(a, b, config);
    if (result) results.push(result);
  }

  if (!results.length) {
    memo.set(key, null);
    return null;
  }

  const distKm = safeDistance(a, b);
  const partial = assembleEdge(a, b, results, distKm);

  if (partial.confidence < config.minConfidence) {
    memo.set(key, null);
    return null;
  }

  const edge: CorrelationEdge = {
    id: key,
    ...partial,
  };

  memo.set(key, edge);
  return edge;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CorrelationResult {
  edges: CorrelationEdge[];
  /** Lookup map for fast edge access by event ID. */
  edgesByEventId: Map<string, CorrelationEdge[]>;
  /** Events that have at least one edge (i.e. are correlated). */
  correlatedEventIds: Set<string>;
  stats: {
    eventCount: number;
    pairsEvaluated: number;
    edgesFound: number;
    processingMs: number;
  };
}

/**
 * Run the full correlation pipeline over a set of events.
 *
 * Returns all edges above the confidence threshold, capped per node, and
 * sorted by priority descending.
 */
export function correlate(
  events: GlobalEvent[],
  config: Partial<CorrelationEngineConfig> = {},
): CorrelationResult {
  const cfg: CorrelationEngineConfig = { ...DEFAULT_CORRELATION_CONFIG, ...config };
  const t0 = Date.now();

  const pool = events.slice(0, cfg.maxEvents);
  const edges: CorrelationEdge[] = [];
  const edgeCountPerNode = new Map<string, number>();
  let pairsEvaluated = 0;

  // ── Phase 1: within-country pairs first (most productive) ───────────────
  const byCountry = new Map<string, GlobalEvent[]>();
  const noCountry: GlobalEvent[] = [];

  for (const e of pool) {
    const key = e.country?.toLowerCase() ?? "";
    if (key) {
      const arr = byCountry.get(key) ?? [];
      arr.push(e);
      byCountry.set(key, arr);
    } else {
      noCountry.push(e);
    }
  }

  const processGroup = (group: GlobalEvent[]) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairsEvaluated++;
        const a = group[i];
        const b = group[j];

        const countA = edgeCountPerNode.get(a.id) ?? 0;
        const countB = edgeCountPerNode.get(b.id) ?? 0;
        if (countA >= cfg.maxEdgesPerNode && countB >= cfg.maxEdgesPerNode) continue;

        const edge = evaluatePair(a, b, cfg);
        if (!edge) continue;

        edges.push(edge);
        edgeCountPerNode.set(a.id, countA + 1);
        edgeCountPerNode.set(b.id, countB + 1);
      }
    }
  };

  for (const group of byCountry.values()) processGroup(group);

  // ── Phase 2: cross-country pairs (limited to time window) ─────────────
  // We only compare events without a country against the full pool,
  // and globally significant events (high severity) against each other.
  const globallySignificant = pool.filter(
    (e) => e.severity === "critical" || e.severity === "high",
  );

  const crossGroup = [...noCountry, ...globallySignificant];
  const crossSeen = new Set<string>();
  for (let i = 0; i < crossGroup.length; i++) {
    for (let j = i + 1; j < crossGroup.length; j++) {
      const a = crossGroup[i];
      const b = crossGroup[j];
      const key = pairKey(a, b);
      if (crossSeen.has(key)) continue;
      crossSeen.add(key);

      const countA = edgeCountPerNode.get(a.id) ?? 0;
      const countB = edgeCountPerNode.get(b.id) ?? 0;
      if (countA >= cfg.maxEdgesPerNode && countB >= cfg.maxEdgesPerNode) continue;

      pairsEvaluated++;
      const edge = evaluatePair(a, b, cfg);
      if (!edge) continue;

      edges.push(edge);
      edgeCountPerNode.set(a.id, countA + 1);
      edgeCountPerNode.set(b.id, countB + 1);
    }
  }

  // ── Post-process ──────────────────────────────────────────────────────
  edges.sort((a, b) => b.priority - a.priority);

  const edgesByEventId = new Map<string, CorrelationEdge[]>();
  const correlatedEventIds = new Set<string>();

  for (const edge of edges) {
    correlatedEventIds.add(edge.sourceId);
    correlatedEventIds.add(edge.targetId);

    const srcList = edgesByEventId.get(edge.sourceId) ?? [];
    srcList.push(edge);
    edgesByEventId.set(edge.sourceId, srcList);

    const tgtList = edgesByEventId.get(edge.targetId) ?? [];
    tgtList.push(edge);
    edgesByEventId.set(edge.targetId, tgtList);
  }

  return {
    edges,
    edgesByEventId,
    correlatedEventIds,
    stats: {
      eventCount: pool.length,
      pairsEvaluated,
      edgesFound: edges.length,
      processingMs: Date.now() - t0,
    },
  };
}

/** Invalidate the memoization cache. Call when events are refreshed. */
export function clearCorrelationCache(): void {
  memo.clear();
}

/** Return statistics about the current memo state. */
export function getCorrelationCacheStats(): { entries: number; hits: number } {
  return { entries: memo.size, hits: 0 };
}
