/**
 * Unified Intelligence Timeline Engine
 *
 * Assembles a single chronological stream from all providers, groups
 * nearby events into TimelineGroups, and enriches each group with
 * cluster membership and severity metadata.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUPPORTED WINDOWS
 * ─────────────────────────────────────────────────────────────────────────
 *   Today        → events from midnight today (local)
 *   Last 24 h    → rolling 24-hour window
 *   Last 7 days  → rolling 7-day window
 *   Last 30 days → rolling 30-day window
 *   Custom       → { fromMs, toMs }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GROUPING STRATEGY
 * ─────────────────────────────────────────────────────────────────────────
 * Events are grouped by calendar period based on the window:
 *   ≤ 24h → group by hour
 *   ≤ 7d  → group by calendar day
 *   ≤ 30d → group by calendar week
 *
 * Groups are labelled with human-readable strings:
 *   "Today", "Yesterday", "2 days ago", "Mon Mar 15", "Last week", etc.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { IntelligenceCluster, TimelineGroup } from "../graph/types";

// ─── Window presets ───────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const DAY = 86_400_000;

export type TimelineWindowId = "today" | "24h" | "7d" | "30d" | "custom";

export interface TimelineWindow {
  id: TimelineWindowId;
  label: string;
  fromMs: number;
  toMs: number;
}

export function resolveTimelineWindow(
  windowId: TimelineWindowId,
  customRange?: { fromMs: number; toMs: number },
  now = Date.now(),
): TimelineWindow {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const presets: Record<Exclude<TimelineWindowId, "custom">, TimelineWindow> = {
    today: { id: "today", label: "Today", fromMs: todayStart.getTime(), toMs: now },
    "24h": { id: "24h", label: "Last 24 Hours", fromMs: now - 24 * HOUR, toMs: now },
    "7d": { id: "7d", label: "Last 7 Days", fromMs: now - 7 * DAY, toMs: now },
    "30d": { id: "30d", label: "Last 30 Days", fromMs: now - 30 * DAY, toMs: now },
  };

  if (windowId === "custom" && customRange) {
    return { id: "custom", label: "Custom Range", ...customRange };
  }

  return presets[windowId as Exclude<TimelineWindowId, "custom">] ?? presets["7d"];
}

// ─── Period labelling ─────────────────────────────────────────────────────────

function periodKey(ms: number, granularity: "hour" | "day" | "week"): string {
  const d = new Date(ms);
  if (granularity === "hour") {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  }
  if (granularity === "week") {
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return `week-${startOfWeek.getTime()}`;
  }
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function periodLabel(ms: number, granularity: "hour" | "day" | "week", now: number): string {
  const diffMs = now - ms;
  const d = new Date(ms);

  if (granularity === "hour") {
    const diffH = Math.floor(diffMs / HOUR);
    if (diffH === 0) return "This hour";
    if (diffH === 1) return "1 hour ago";
    if (diffH < 24) return `${diffH} hours ago`;
    return `${d.getHours()}:00 on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  if (granularity === "week") {
    const diffWeeks = Math.floor(diffMs / (7 * DAY));
    if (diffWeeks === 0) return "This week";
    if (diffWeeks === 1) return "Last week";
    return `${diffWeeks} weeks ago`;
  }

  // Day granularity
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - DAY);
  const dStart = new Date(d);
  dStart.setHours(0, 0, 0, 0);

  if (dStart.getTime() === todayStart.getTime()) return "Today";
  if (dStart.getTime() === yesterdayStart.getTime()) return "Yesterday";

  const diffDays = Math.floor(diffMs / DAY);
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function granularityFor(windowMs: number): "hour" | "day" | "week" {
  if (windowMs <= 24 * HOUR) return "hour";
  if (windowMs <= 7 * DAY) return "day";
  return "week";
}

// ─── Severity utilities ───────────────────────────────────────────────────────

const SEV_ORDER: GlobalEventSeverity[] = ["critical", "high", "medium", "low"];

function highestSeverity(events: GlobalEvent[]): GlobalEventSeverity {
  for (const s of SEV_ORDER) {
    if (events.some((e) => e.severity === s)) return s;
  }
  return "low";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a unified timeline from events and clusters.
 *
 * @param events    All events from the EventEngine (already sorted by recency)
 * @param clusters  Clusters from the cluster engine (used for group labelling)
 * @param windowMs  Time window in milliseconds (default 7 days)
 */
export function buildTimeline(
  events: GlobalEvent[],
  clusters: IntelligenceCluster[],
  windowMs = 7 * DAY,
  now = Date.now(),
): TimelineGroup[] {
  const fromMs = now - windowMs;
  const withinWindow = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t >= fromMs && t <= now;
  });

  if (!withinWindow.length) return [];

  const granularity = granularityFor(windowMs);
  const groups = new Map<string, GlobalEvent[]>();

  for (const event of withinWindow) {
    const key = periodKey(new Date(event.timestamp).getTime(), granularity);
    const arr = groups.get(key) ?? [];
    arr.push(event);
    groups.set(key, arr);
  }

  // Build cluster membership lookup
  const eventClusterMap = new Map<string, string>();
  for (const cluster of clusters) {
    for (const e of cluster.events) {
      eventClusterMap.set(e.id, cluster.id);
    }
  }

  const result: TimelineGroup[] = [];

  for (const [key, groupEvents] of groups) {
    const timestamps = groupEvents.map((e) => new Date(e.timestamp).getTime());
    const periodStartMs = Math.min(...timestamps);
    const periodEndMs = Math.max(...timestamps);

    // Detect if entire group belongs to one cluster
    const clusterIds = new Set(
      groupEvents.map((e) => eventClusterMap.get(e.id)).filter(Boolean),
    );
    const soloClusterId = clusterIds.size === 1 ? [...clusterIds][0] : undefined;

    const countries = [
      ...new Set(groupEvents.map((e) => e.country).filter((c): c is string => !!c)),
    ];
    const categories = [
      ...new Set(groupEvents.map((e) => e.category) as GlobalEventCategory[]),
    ];

    result.push({
      id: `tg-${key}`,
      label: periodLabel(periodStartMs, granularity, now),
      periodStartIso: new Date(periodStartMs).toISOString(),
      periodEndIso: new Date(periodEndMs).toISOString(),
      events: groupEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      countries,
      categories,
      highestSeverity: highestSeverity(groupEvents),
      clusterId: soloClusterId,
    });
  }

  // Sort groups newest first
  result.sort(
    (a, b) =>
      new Date(b.periodStartIso).getTime() - new Date(a.periodStartIso).getTime(),
  );

  return result;
}

/**
 * Filter an existing timeline to a sub-window.
 * Useful for drill-down (e.g. "show only today from a 7-day timeline").
 */
export function filterTimeline(
  timeline: TimelineGroup[],
  fromMs: number,
  toMs: number,
): TimelineGroup[] {
  return timeline
    .map((group) => ({
      ...group,
      events: group.events.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= fromMs && t <= toMs;
      }),
    }))
    .filter((group) => group.events.length > 0);
}
