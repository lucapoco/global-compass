/**
 * AnimatedCounter — Bonus feature.
 *
 * Smooth count-up animation when the `to` value changes.
 * Uses requestAnimationFrame with cubic ease-out for a professional feel.
 * Zero external dependencies — works in SSR (no-ops on server).
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  duration?: number;    // ms, default 800
  decimals?: number;    // decimal places, default 0
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  to,
  duration = 800,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: Props) {
  const [display, setDisplay] = useState(to);
  const frameRef = useRef<number | null>(null);
  const startValRef = useRef(to);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const from = startValRef.current;
    if (from === to) return;

    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    startTimeRef.current = null;

    const tick = (timestamp: number) => {
      if (startTimeRef.current == null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      setDisplay(+value.toFixed(decimals));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        startValRef.current = to;
        setDisplay(to);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [to, duration, decimals]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
