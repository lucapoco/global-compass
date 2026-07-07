import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { ReplayState } from "../types";

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;

/** Earliest/latest timestamp across a set of events — the replay window bounds. */
export function replayBoundsFor(events: GlobalEvent[]): { startMs: number; endMs: number } {
  if (!events.length) {
    const now = Date.now();
    return { startMs: now - 24 * 60 * 60 * 1000, endMs: now };
  }
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t < startMs) startMs = t;
    if (t > endMs) endMs = t;
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    const now = Date.now();
    return { startMs: now - 24 * 60 * 60 * 1000, endMs: now };
  }
  return { startMs, endMs };
}

/**
 * Pure tick function: advances the replay cursor by `realDeltaMs * speed * timeScale`
 * event-time milliseconds. `timeScale` compresses the whole window into a ~60s replay
 * by default so long windows (30 days) still animate in a reasonable wall-clock time.
 */
export function tickReplay(state: ReplayState, realDeltaMs: number, timeScale: number): ReplayState {
  if (!state.isPlaying) return state;
  const nextCursor = state.cursorMs + realDeltaMs * state.speed * timeScale;
  if (nextCursor >= state.endMs) {
    return { ...state, cursorMs: state.endMs, isPlaying: false };
  }
  return { ...state, cursorMs: nextCursor };
}

/** Suggested timeScale so the full window animates in ~`targetSeconds` at speed=1. */
export function timeScaleForWindow(startMs: number, endMs: number, targetSeconds = 60): number {
  const windowMs = Math.max(1, endMs - startMs);
  return windowMs / (targetSeconds * 1000);
}

/** Events that have "appeared" by the current replay cursor. */
export function eventsUpToCursor(events: GlobalEvent[], cursorMs: number): GlobalEvent[] {
  return events.filter((e) => new Date(e.timestamp).getTime() <= cursorMs);
}

export function createReplayState(events: GlobalEvent[], speed = 1): ReplayState {
  const { startMs, endMs } = replayBoundsFor(events);
  return { isPlaying: false, cursorMs: startMs, startMs, endMs, speed };
}
