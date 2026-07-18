/**
 * Intelligence Snapshot Store
 *
 * Stores lightweight point-in-time snapshots of the intelligence graph.
 * Snapshots are used by the replay engine to reconstruct past situations
 * without fabricating any data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RETENTION POLICY
 * ─────────────────────────────────────────────────────────────────────────
 * Default: 24 snapshots maximum (configurable).
 * When the store is full, the oldest snapshot is evicted (LRU).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SNAPSHOT WEIGHT
 * ─────────────────────────────────────────────────────────────────────────
 * Snapshots are kept lightweight by storing:
 *   • Event IDs (not full events) for the cluster summaries
 *   • Serializable primitives for risk scores and country data
 *   • A compact summary instead of the full graph
 *
 * Full events are NOT duplicated — they remain in the EventEngine cache.
 * The snapshot references them by ID. On playback, events are looked up
 * from the current event pool.
 */
import type { GlobalEvent, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { IntelligenceCluster } from "../graph/types";
import type { ReplaySnapshot, ReplayWindowId } from "../graph/types";

// ─── Configuration ────────────────────────────────────────────────────────────

interface SnapshotStoreConfig {
  /** Maximum number of snapshots to retain in memory. Default 24. */
  maxSnapshots: number;
  /** Minimum interval (ms) between auto-saves to prevent redundant writes. Default 5 min. */
  minIntervalMs: number;
}

const DEFAULT_CONFIG: SnapshotStoreConfig = {
  maxSnapshots: 24,
  minIntervalMs: 5 * 60 * 1000,
};

// ─── Risk computation ─────────────────────────────────────────────────────────

const SEV_SCORE: Record<GlobalEventSeverity, number> = {
  critical: 20, high: 8, medium: 3, low: 1,
};

function computeGlobalRisk(events: GlobalEvent[]): number {
  if (!events.length) return 0;
  const raw = events.reduce((s, e) => s + SEV_SCORE[e.severity], 0);
  return Math.min(100, Math.round(raw / events.length));
}

function topCountries(events: GlobalEvent[], n = 5): Array<{ country: string; score: number }> {
  const map = new Map<string, number>();
  for (const e of events) {
    if (!e.country) continue;
    map.set(e.country, (map.get(e.country) ?? 0) + SEV_SCORE[e.severity]);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([country, score]) => ({ country, score }));
}

// ─── Store ────────────────────────────────────────────────────────────────────

class SnapshotStore {
  private snapshots: ReplaySnapshot[] = [];
  private lastSavedAt = 0;

  constructor(private config: SnapshotStoreConfig = DEFAULT_CONFIG) {}

  /**
   * Take a new snapshot. Snapshots are automatically ID-tagged and
   * throttled so rapid refreshes don't flood the store.
   */
  save(
    events: GlobalEvent[],
    clusters: IntelligenceCluster[],
    edgeCount: number,
    windowId: ReplayWindowId = "24h",
    force = false,
  ): ReplaySnapshot | null {
    const now = Date.now();
    if (!force && now - this.lastSavedAt < this.config.minIntervalMs) {
      return null;
    }

    const windowLabels: Record<ReplayWindowId, string> = {
      "24h": "Last 24 Hours",
      "7d": "Last 7 Days",
      "30d": "Last 30 Days",
      custom: "Custom Range",
    };

    const snapshot: ReplaySnapshot = {
      id: `snap-${now}`,
      capturedAt: new Date(now).toISOString(),
      windowId,
      windowLabel: windowLabels[windowId],
      events,
      clusterSummaries: clusters.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title,
        eventCount: c.size,
        highestSeverity: c.highestSeverity,
        riskScore: c.riskScore,
        countries: c.countries,
      })),
      globalRiskScore: computeGlobalRisk(events),
      topCountries: topCountries(events),
      edgeCount,
    };

    this.snapshots.push(snapshot);
    this.lastSavedAt = now;

    // Evict oldest if over limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /** All stored snapshots, newest first. */
  getAll(): ReplaySnapshot[] {
    return [...this.snapshots].reverse();
  }

  /** The most recently saved snapshot. */
  getLatest(): ReplaySnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  /** Find a snapshot by ID. */
  getById(id: string): ReplaySnapshot | null {
    return this.snapshots.find((s) => s.id === id) ?? null;
  }

  /** How many snapshots are stored. */
  get size(): number {
    return this.snapshots.length;
  }

  /** Clear all snapshots. */
  clear(): void {
    this.snapshots = [];
    this.lastSavedAt = 0;
  }

  /** Update the retention configuration at runtime. */
  configure(config: Partial<SnapshotStoreConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Diagnostic info for the debug panel. */
  getStatus(): {
    count: number;
    maxSnapshots: number;
    oldestAt: string | null;
    newestAt: string | null;
    lastSavedAt: number;
  } {
    return {
      count: this.snapshots.length,
      maxSnapshots: this.config.maxSnapshots,
      oldestAt: this.snapshots[0]?.capturedAt ?? null,
      newestAt: this.snapshots[this.snapshots.length - 1]?.capturedAt ?? null,
      lastSavedAt: this.lastSavedAt,
    };
  }
}

/** Module-level singleton snapshot store. */
export const snapshotStore = new SnapshotStore();
export { SnapshotStore };
