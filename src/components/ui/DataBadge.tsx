import type { ReactNode } from "react";

type Variant = "live" | "demo" | "error" | "neutral" | "source";

const styles: Record<Variant, string> = {
  live: "bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30",
  demo: "bg-amber-glow/15 text-amber-glow border-amber-glow/30",
  error: "bg-rose-glow/15 text-rose-glow border-rose-glow/30",
  neutral: "bg-secondary/40 text-muted-foreground border-border/60",
  source: "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/30",
};

export function DataBadge({ variant = "neutral", children }: { variant?: Variant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[variant]}`}>
      {variant === "live" && <span className="live-dot" />}
      {children}
    </span>
  );
}
