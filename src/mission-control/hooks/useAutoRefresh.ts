/**
 * useAutoRefresh — Intelligent polling hook for Mission Control.
 *
 * Manages a refresh countdown and fires a callback at each interval.
 * Pauses automatically when the page is hidden (tab not active),
 * preventing unnecessary background requests.
 */
import { useEffect, useRef, useState, useCallback } from "react";

interface UseAutoRefreshOptions {
  intervalMs: number;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
}

export function useAutoRefresh({ intervalMs, onRefresh, enabled = true }: UseAutoRefreshOptions) {
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(intervalMs / 1000));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(Math.floor(intervalMs / 1000));
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const reset = useCallback(() => {
    secondsRef.current = Math.floor(intervalMs / 1000);
    setSecondsLeft(secondsRef.current);
  }, [intervalMs]);

  const triggerRefresh = useCallback(async () => {
    await onRefreshRef.current();
    reset();
  }, [reset]);

  useEffect(() => {
    if (!enabled) return;

    // Main interval
    timerRef.current = setInterval(() => {
      void triggerRefresh();
    }, intervalMs);

    // Countdown ticker (every second)
    countdownRef.current = setInterval(() => {
      secondsRef.current = Math.max(0, secondsRef.current - 1);
      setSecondsLeft(secondsRef.current);
    }, 1000);

    // Pause on hidden
    function handleVisibilityChange() {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        // Resume and immediately refresh
        void triggerRefresh();
        timerRef.current = setInterval(() => void triggerRefresh(), intervalMs);
        countdownRef.current = setInterval(() => {
          secondsRef.current = Math.max(0, secondsRef.current - 1);
          setSecondsLeft(secondsRef.current);
        }, 1000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, triggerRefresh]);

  return { secondsLeft, triggerNow: triggerRefresh };
}
