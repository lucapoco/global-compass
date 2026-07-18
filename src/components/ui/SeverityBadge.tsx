/**
 * SeverityBadge — threat severity level indicator.
 *
 * Maps IntelligenceItem.severity to a colour-coded pill.
 * Accepts both Severity enum values ("Critical", "High", …) and
 * lowercase string variants ("critical", "high", …) from raw API data.
 */
import type { Severity } from "@/types";

type SeverityInput = Severity | Lowercase<Severity> | string;

interface Config {
  className: string;
  dot: string;
}

const SEVERITY_MAP: Record<string, Config> = {
  critical: {
    className: "bg-rose-glow/15 text-rose-glow border-rose-glow/35",
    dot: "bg-rose-glow",
  },
  high: {
    className: "bg-amber-glow/15 text-amber-glow border-amber-glow/35",
    dot: "bg-amber-glow",
  },
  medium: {
    className: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/35",
    dot: "bg-cyan-glow",
  },
  low: {
    className: "bg-emerald-glow/12 text-emerald-glow border-emerald-glow/30",
    dot: "bg-emerald-glow",
  },
};

export function SeverityBadge({ severity }: { severity: SeverityInput }) {
  const key = String(severity).toLowerCase();
  const config = SEVERITY_MAP[key] ?? SEVERITY_MAP.low;

  return (
    <span
      role="img"
      aria-label={`Severity: ${severity}`}
      className={[
        "inline-flex items-center gap-1 rounded-full border",
        "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        "leading-none select-none flex-shrink-0",
        config.className,
      ].join(" ")}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.dot}`} aria-hidden="true" />
      {String(severity)}
    </span>
  );
}
