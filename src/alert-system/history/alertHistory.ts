/**
 * Alert History Store
 *
 * In-memory time-series store for GlobalAlert snapshots, enabling:
 *   • Historical review (24h / 7d / 30d / all time)
 *   • Diffing between refreshes (new / escalated / resolved detection)
 *   • Replay integration (reuses the same snapshot shape as the
 *     Event Correlation Engine's SnapshotStore for consistency)
 *
 * This is a client-session store (resets on full page reload), which is
 * sufficient for a live monitoring dashboard. It intentionally avoids
 * persisting to Supabase to keep the Alert Engine fast and independent
 * from network latency — only Watchlists are persisted (see watchlists/).
 */
import type { GlobalAlert, HistoryWindow, AlertLevel } from "../types";
import { ALERT_LEVEL_ORDER } from "../types";

interface AlertSnapshot {
  timestamp: number;
  alerts: GlobalAlert[];
}

const MAX_SNAPSHOTS = 500;
const MIN_SNAPSHOT_INTERVAL_MS = 60_000; // avoid recording duplicate near-identical snapshots

class AlertHistoryStore {
  private snapshots: AlertSnapshot[] = [];
  private previousAlerts: Map<string, GlobalAlert> = new Map();

  /** Record a new snapshot and return the diff against the previous one. */
  record(alerts: GlobalAlert[]): AlertDiff {
    const now = Date.now();
    const last = this.snapshots[this.snapshots.length - 1];

    if (!last || now - last.timestamp >= MIN_SNAPSHOT_INTERVAL_MS) {
      this.snapshots.push({ timestamp: now, alerts });
      if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
    }

    const diff = computeDiff(this.previousAlerts, alerts);
    this.previousAlerts = new Map(alerts.map((a) => [a.id, a]));
    return diff;
  }

  /** All alerts observed within a given history window (deduplicated by ID, most recent state kept). */
  getWindow(window: HistoryWindow): GlobalAlert[] {
    const now = Date.now();
    const windowMs: Record<HistoryWindow, number> = {
      "24h": 86_400_000,
      "7d": 7 * 86_400_000,
      "30d": 30 * 86_400_000,
      all: Number.POSITIVE_INFINITY,
    };
    const cutoff = now - windowMs[window];

    const merged = new Map<string, GlobalAlert>();
    for (const snap of this.snapshots) {
      if (snap.timestamp < cutoff) continue;
      for (const alert of snap.alerts) {
        const existing = merged.get(alert.id);
        if (!existing || new Date(alert.lastUpdatedAt) > new Date(existing.lastUpdatedAt)) {
          merged.set(alert.id, alert);
        }
      }
    }
    return [...merged.values()].sort((a, b) => b.priority - a.priority);
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  clear(): void {
    this.snapshots = [];
    this.previousAlerts = new Map();
  }
}

// ─── Diff computation ─────────────────────────────────────────────────────────

export interface AlertDiff {
  newAlerts: GlobalAlert[];
  escalatedAlerts: Array<{ alert: GlobalAlert; previousLevel: AlertLevel }>;
  resolvedAlerts: GlobalAlert[];
}

function computeDiff(previous: Map<string, GlobalAlert>, current: GlobalAlert[]): AlertDiff {
  const newAlerts: GlobalAlert[] = [];
  const escalatedAlerts: AlertDiff["escalatedAlerts"] = [];
  const resolvedAlerts: GlobalAlert[] = [];

  const currentIds = new Set(current.map((a) => a.id));

  for (const alert of current) {
    const prev = previous.get(alert.id);
    if (!prev) {
      newAlerts.push(alert);
      continue;
    }
    const prevIdx = ALERT_LEVEL_ORDER.indexOf(prev.level);
    const currIdx = ALERT_LEVEL_ORDER.indexOf(alert.level);
    if (currIdx > prevIdx) {
      escalatedAlerts.push({ alert, previousLevel: prev.level });
    }
  }

  for (const [id, prevAlert] of previous) {
    if (!currentIds.has(id) || current.find((a) => a.id === id)?.status === "resolved") {
      if (prevAlert.status !== "resolved") resolvedAlerts.push(prevAlert);
    }
  }

  return { newAlerts, escalatedAlerts, resolvedAlerts };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const alertHistoryStore = new AlertHistoryStore();
