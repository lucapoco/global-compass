/**
 * Intelligence Replay Engine
 *
 * Allows the application to reconstruct historical intelligence situations
 * by scrubbing through a time window using a cursor.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KEY PRINCIPLES
 * ─────────────────────────────────────────────────────────────────────────
 * • No fake history — replay ONLY uses real cached data from providers.
 * • The cursor represents "what did the platform know at this moment?"
 * • In accumulating mode (windowMs = 0), events accumulate as the cursor
 *   advances. In sliding mode (windowMs > 0), only events within the
 *   window before the cursor are shown.
 * • Playback speed is configurable: 0.5x, 1x, 2x, 4x, 8x.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTEGRATION WITH THE GRAPH ENGINE
 * ─────────────────────────────────────────────────────────────────────────
 * The replay engine is pure / stateless. Consumers (React hooks, UI components)
 * manage the `ReplayState` object and call `tickReplay()` on each animation frame.
 *
 * To get correlated events at any cursor position:
 *   const eventsAtCursor = getEventsAtCursor(allEvents, state);
 *   const graphAtCursor  = buildGraph(eventsAtCursor);
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { ReplayState, ReplayWindowId } from "../graph/types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

const HOUR = 3_600_000;
const DAY = 86_400_000;

const WINDOW_MS: Record<Exclude<ReplayWindowId, "custom">, number> = {
  "24h": 24 * HOUR,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
};

/**
 * Default time-scale factor: compresses the window so the full replay
 * completes in ~60 seconds at speed=1.
 */
function defaultTimeScale(startMs: number, endMs: number): number {
  const windowMs = Math.max(1, endMs - startMs);
  return windowMs / (60 * 1000);
}

// ─── State factories ──────────────────────────────────────────────────────────

export function createReplayState(
  events: GlobalEvent[],
  windowId: ReplayWindowId = "24h",
  speed: ReplaySpeed = 1,
  customRange?: { fromMs: number; toMs: number },
): ReplayState {
  const now = Date.now();
  let startMs: number;
  let endMs: number;

  if (windowId === "custom" && customRange) {
    startMs = customRange.fromMs;
    endMs = customRange.toMs;
  } else {
    const windowMs = WINDOW_MS[windowId as Exclude<ReplayWindowId, "custom">] ?? 24 * HOUR;
    // Clamp to actual event range
    const eventTimes = events
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !isNaN(t));

    if (eventTimes.length > 0) {
      startMs = Math.max(Math.min(...eventTimes), now - windowMs);
      endMs = Math.min(Math.max(...eventTimes), now);
    } else {
      startMs = now - windowMs;
      endMs = now;
    }
  }

  return {
    isPlaying: false,
    cursorMs: startMs,
    startMs,
    endMs,
    speed,
    windowMs: 0, // accumulating mode by default
  };
}

// ─── Tick function ────────────────────────────────────────────────────────────

/**
 * Pure tick: advances `cursorMs` by `realDeltaMs × speed × timeScale`.
 *
 * Call this on each animation frame (requestAnimationFrame).
 * The function is pure — it does not mutate state.
 *
 * @param state         Current replay state
 * @param realDeltaMs   Wall-clock milliseconds since last tick
 * @param timeScale     Compression factor (use `defaultTimeScale()` or custom)
 * @returns             New state object (immutable update)
 */
export function tickReplay(
  state: ReplayState,
  realDeltaMs: number,
  timeScale?: number,
): ReplayState {
  if (!state.isPlaying) return state;

  const scale = timeScale ?? defaultTimeScale(state.startMs, state.endMs);
  const advance = realDeltaMs * state.speed * scale;
  const nextCursor = state.cursorMs + advance;

  if (nextCursor >= state.endMs) {
    return { ...state, cursorMs: state.endMs, isPlaying: false };
  }

  return { ...state, cursorMs: nextCursor };
}

// ─── Event slicing ────────────────────────────────────────────────────────────

/**
 * Return events "visible" at the current cursor position.
 *
 * Accumulating mode (state.windowMs = 0):
 *   Shows all events with timestamp ≤ cursorMs.
 *
 * Sliding window mode (state.windowMs > 0):
 *   Shows only events within [cursorMs - windowMs, cursorMs].
 */
export function getEventsAtCursor(
  events: GlobalEvent[],
  state: ReplayState,
): GlobalEvent[] {
  const { cursorMs, windowMs } = state;
  const fromMs = windowMs > 0 ? cursorMs - windowMs : 0;

  return events
    .filter((e) => {
      const t = new Date(e.timestamp).getTime();
      if (isNaN(t)) return false;
      return t <= cursorMs && (windowMs === 0 || t >= fromMs);
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── Control helpers ──────────────────────────────────────────────────────────

export const replayControls = {
  play: (s: ReplayState): ReplayState => ({ ...s, isPlaying: true }),
  pause: (s: ReplayState): ReplayState => ({ ...s, isPlaying: false }),
  stop: (s: ReplayState): ReplayState => ({ ...s, isPlaying: false, cursorMs: s.startMs }),
  seekTo: (s: ReplayState, ms: number): ReplayState => ({
    ...s,
    cursorMs: Math.max(s.startMs, Math.min(s.endMs, ms)),
  }),
  setSpeed: (s: ReplayState, speed: ReplaySpeed): ReplayState => ({ ...s, speed }),
  toggleWindow: (s: ReplayState, windowMs: number): ReplayState => ({ ...s, windowMs }),
};

// ─── Progress utilities ───────────────────────────────────────────────────────

/** Progress 0–1 through the replay window. */
export function replayProgress(state: ReplayState): number {
  const range = state.endMs - state.startMs;
  if (range <= 0) return 1;
  return Math.min(1, Math.max(0, (state.cursorMs - state.startMs) / range));
}

/** Human-readable label for the current cursor position. */
export function cursorLabel(state: ReplayState): string {
  const d = new Date(state.cursorMs);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
