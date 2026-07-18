/**
 * StatCard — metric display card for dashboards.
 */
import type { ReactNode } from "react";
import { AnimatedCounter } from "./AnimatedCounter";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "rose";
  animatedValue?: number;
  trend?: "up" | "down" | "neutral";
}

const accentMap = {
  cyan:    { text: "text-primary",    border: "border-primary/20" },
  emerald: { text: "text-emerald-glow", border: "border-emerald-glow/20" },
  amber:   { text: "text-amber-glow",   border: "border-amber-glow/20" },
  rose:    { text: "text-rose-glow",    border: "border-rose-glow/20" },
} as const;

const trendMap = {
  up:      "↑",
  down:    "↓",
  neutral: "→",
};

export function StatCard({ label, value, hint, icon, accent = "cyan", animatedValue, trend }: Props) {
  const a = accentMap[accent];

  return (
    <div
      className="glass-card relative min-w-0 overflow-hidden p-4 transition-standard hover-lift"
      aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : label}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-label text-muted-foreground leading-none mb-2">{label}</div>
          <div className="text-heading-m tabular-nums">
            {animatedValue !== undefined ? (
              <AnimatedCounter to={animatedValue} />
            ) : (
              value
            )}
          </div>
          {hint && (
            <div className="mt-1.5 truncate text-micro leading-snug text-muted-foreground">{hint}</div>
          )}
          {trend && (
            <div className={[
              "text-micro font-medium mt-1",
              trend === "up" ? "text-rose-glow" : trend === "down" ? "text-emerald-glow" : "text-muted-foreground",
            ].join(" ")}>
              {trendMap[trend]}
            </div>
          )}
        </div>
        {icon && (
          <div className={`flex-shrink-0 rounded-lg border p-2 ${a.text} ${a.border} bg-secondary/30`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
