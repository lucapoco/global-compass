import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import {
  createReplayState,
  eventsUpToCursor,
  tickReplay,
  timeScaleForWindow,
  REPLAY_SPEEDS,
} from "@/domain/services/map-engine";
import type { ReplayState } from "@/domain/services/map-engine/types";

export interface UseReplayResult {
  state: ReplayState;
  visibleEvents: GlobalEvent[];
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  jumpToDate: (date: Date | number) => void;
  jumpToProgress: (progress01: number) => void;
  speeds: readonly number[];
  progress: number; // 0-1
}

const TICK_MS = 100;

/**
 * Chronological replay controller for a set of GlobalEvents. Events "appear" on the
 * map in publish order as the cursor advances — intelligence-replay style Play /
 * Pause / Reset / Speed / Jump-to-date.
 */
export function useReplay(events: GlobalEvent[], active: boolean): UseReplayResult {
  const [state, setState] = useState<ReplayState>(() => createReplayState(events));
  const timeScaleRef = useRef(timeScaleForWindow(state.startMs, state.endMs));

  // Recompute bounds whenever the underlying (filtered) event set changes.
  useEffect(() => {
    setState((prev) => {
      const next = createReplayState(events, prev.speed);
      timeScaleRef.current = timeScaleForWindow(next.startMs, next.endMs);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, events[0]?.id]);

  useEffect(() => {
    if (!active || !state.isPlaying) return;
    const id = setInterval(() => {
      setState((prev) => tickReplay(prev, TICK_MS, timeScaleRef.current));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, state.isPlaying]);

  const play = useCallback(() => setState((s) => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, isPlaying: false })), []);
  const reset = useCallback(() => setState((s) => ({ ...s, isPlaying: false, cursorMs: s.startMs })), []);
  const setSpeed = useCallback((speed: number) => setState((s) => ({ ...s, speed })), []);
  const jumpToDate = useCallback((date: Date | number) => {
    const t = typeof date === "number" ? date : date.getTime();
    setState((s) => ({ ...s, cursorMs: Math.min(s.endMs, Math.max(s.startMs, t)) }));
  }, []);
  const jumpToProgress = useCallback((progress01: number) => {
    setState((s) => ({ ...s, cursorMs: s.startMs + (s.endMs - s.startMs) * Math.min(1, Math.max(0, progress01)) }));
  }, []);

  const visibleEvents = useMemo(
    () => (active ? eventsUpToCursor(events, state.cursorMs) : events),
    [active, events, state.cursorMs],
  );

  const progress = state.endMs === state.startMs ? 1 : (state.cursorMs - state.startMs) / (state.endMs - state.startMs);

  return { state, visibleEvents, play, pause, reset, setSpeed, jumpToDate, jumpToProgress, speeds: REPLAY_SPEEDS, progress };
}
