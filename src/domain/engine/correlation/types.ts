/**
 * Event Correlation Engine — Type Definitions
 *
 * Every meaningful relationship detected between GlobalEvents is modelled
 * as a CorrelationEdge. Multiple relationship types can apply simultaneously
 * (e.g. same country AND same time window AND causal pattern).
 *
 * Score semantics (all 0–100):
 *   confidence   How certain we are this relationship is real
 *   strength     How tightly coupled the two events are
 *   priority     How important this edge is for the user (drives display order)
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";

// ─── Relationship taxonomy ─────────────────────────────────────────────────

export type CorrelationRelationship =
  | "same_country"        // Both events attributed to the same country
  | "same_region"         // Both events in the same continent or ACLED region
  | "same_category"       // Identical GPIE category
  | "time_proximity"      // Published within a configurable time window
  | "keyword_similarity"  // Jaccard similarity of tokenized titles exceeds threshold
  | "cause_effect"        // Known causal pattern detected (e.g. earthquake → disaster)
  | "escalation"          // Same location+category, severity increasing over time
  | "continuation"        // Same location+category, multiple consecutive days
  | "cross_provider"      // Same event confirmed by two or more independent providers
  | "cluster_member";     // Both events belong to the same intelligence cluster

// ─── Per-strategy result ───────────────────────────────────────────────────

/**
 * Output of one correlation strategy for a specific event pair.
 * Strategies that do not find a match return `null`.
 */
export interface StrategyResult {
  /** Which relationship type this strategy detected. */
  relationship: CorrelationRelationship;
  /** 0–100: strategy's confidence contribution. */
  score: number;
  /** 0–1: how much this strategy's score is weighted in the final blend. */
  weight: number;
  /** Human-readable fragment used to build the full explanation. */
  reason: string;
}

// ─── Core edge model ───────────────────────────────────────────────────────

/** One individual factor that contributed to a correlation edge. */
export interface CorrelationFactor {
  relationship: CorrelationRelationship;
  score: number;
  reason: string;
}

/**
 * A directed edge in the intelligence graph.
 * sourceId → targetId indicates temporal order (source happened before target)
 * when known; otherwise order reflects riskScore (higher = source).
 */
export interface CorrelationEdge {
  id: string;               // `${sourceId}~${targetId}` — stable and deterministic
  sourceId: string;
  targetId: string;
  relationships: CorrelationRelationship[];
  confidence: number;       // 0–100 weighted blend of strategy scores
  strength: number;         // 0–100 derived from factor count + diversity
  priority: number;         // 0–100 user-facing importance
  timeDifferenceMs: number; // |timestamp_a - timestamp_b| in milliseconds
  distanceKm: number | null;// null when either event lacks coordinates
  explanation: string;      // Human-readable multi-line explanation
  factors: CorrelationFactor[];
}

// ─── Engine configuration ──────────────────────────────────────────────────

export interface CorrelationEngineConfig {
  /** Two events within this distance (km) are geographically related. Default 300. */
  maxDistanceKm: number;
  /** Same-country match when country strings match (case-insensitive). Default true. */
  enableCountryMatch: boolean;
  /** Events within this many hours score a time-proximity point. Default 48. */
  maxHoursApart: number;
  /** Minimum Jaccard similarity for keyword match. Default 0.15. */
  minKeywordSimilarity: number;
  /** Minimum confidence to include an edge in the graph. Default 30. */
  minConfidence: number;
  /**
   * Max events per correlation pass. Bounds the O(N²) comparison.
   * At N=500 → 125 000 pairs; each pair is ~10 ops → ~1.25 M ops (fast in JS).
   * Default 500.
   */
  maxEvents: number;
  /** Max edges per node. Prevents hairball graphs. Default 8. */
  maxEdgesPerNode: number;
  /** Enable causal pattern detection. Default true. */
  enableCausalPatterns: boolean;
}

export const DEFAULT_CORRELATION_CONFIG: CorrelationEngineConfig = {
  maxDistanceKm: 300,
  enableCountryMatch: true,
  maxHoursApart: 48,
  minKeywordSimilarity: 0.15,
  minConfidence: 30,
  maxEvents: 500,
  maxEdgesPerNode: 8,
  enableCausalPatterns: true,
};

// ─── Strategy interface ────────────────────────────────────────────────────

/** Contract for pluggable correlation strategies. */
export interface CorrelationStrategy {
  name: string;
  run(
    a: GlobalEvent,
    b: GlobalEvent,
    config: CorrelationEngineConfig,
  ): StrategyResult | null;
}

// ─── Cluster & Graph types (cross-referenced here to avoid circular imports) ──

export interface ClusterSummary {
  id: string;
  title: string;
  eventCount: number;
  countries: string[];
  categories: GlobalEventCategory[];
  highestSeverity: GlobalEventSeverity;
  riskScore: number;
}
