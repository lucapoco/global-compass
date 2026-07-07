import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { TimelineRange, TimelineRangeId } from "../types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const TIMELINE_PRESETS: { id: TimelineRangeId; label: string; windowMs?: number }[] = [
  { id: "6h", label: "Last 6 hours", windowMs: 6 * HOUR },
  { id: "24h", label: "Last 24 hours", windowMs: 24 * HOUR },
  { id: "48h", label: "Last 48 hours", windowMs: 48 * HOUR },
  { id: "7d", label: "Last 7 days", windowMs: 7 * DAY },
  { id: "30d", label: "Last 30 days", windowMs: 30 * DAY },
  { id: "custom", label: "Custom range" },
];

export const DEFAULT_TIMELINE_RANGE: TimelineRange = { id: "30d", windowMs: 30 * DAY };

export function resolveTimelineWindow(range: TimelineRange, now: number = Date.now()): { fromMs: number; toMs: number } {
  if (range.id === "custom") {
    return { fromMs: range.fromMs ?? now - 30 * DAY, toMs: range.toMs ?? now };
  }
  return { fromMs: now - (range.windowMs ?? 30 * DAY), toMs: now };
}

/** Instantly filters events to the given timeline range (used by the map, replay, and any future consumer). */
export function filterByTimeline(events: GlobalEvent[], range: TimelineRange, now: number = Date.now()): GlobalEvent[] {
  const { fromMs, toMs } = resolveTimelineWindow(range, now);
  return events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t)) return false;
    return t >= fromMs && t <= toMs;
  });
}
