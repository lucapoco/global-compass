/**
 * DataBadge — status / source pill labels.
 *
 * Variants:
 *  live    — emerald, animated pulse dot (data is live / fresh)
 *  demo    — amber (demo / mock data)
 *  cached  — same as demo but different label convention
 *  error   — rose (data fetch failed)
 *  neutral — muted (informational)
 *  source  — cyan (data source attribution)
 *  primary — primary color (feature badge, "New", etc.)
 */
import type { ReactNode } from "react";

type Variant = "live" | "demo" | "cached" | "error" | "neutral" | "source" | "primary";

const styles: Record<Variant, string> = {
  live:    "bg-emerald-glow/12 text-emerald-glow border-emerald-glow/30",
  demo:    "bg-amber-glow/12 text-amber-glow border-amber-glow/30",
  cached:  "bg-amber-glow/12 text-amber-glow border-amber-glow/30",
  error:   "bg-rose-glow/12 text-rose-glow border-rose-glow/30",
  neutral: "bg-secondary/50 text-muted-foreground border-border/60",
  source:  "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/30",
  primary: "bg-primary/12 text-primary border-primary/30",
};

export function DataBadge({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border",
        "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        "leading-none select-none",
        styles[variant],
      ].join(" ")}
    >
      {variant === "live" && (
        <span className="live-dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
