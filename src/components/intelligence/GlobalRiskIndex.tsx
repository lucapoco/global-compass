/**
 * GlobalRiskIndex — composite world risk score display.
 *
 * Shows: risk score · status (Stable/Elevated/High/Critical) ·
 *        trend vs previous · component breakdown · top threats
 */
import type { GlobalRiskIndex as GlobalRiskData } from "@/services/intelligence/types";
import { RISK_STATUS_META } from "@/services/intelligence/risk/globalRisk";
import { TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";

interface Props {
  data: GlobalRiskData;
}

const COMPONENT_LABELS: Record<string, string> = {
  military: "Military",
  economic: "Economic",
  climate: "Climate/Weather",
  cyber: "Cyber",
  health: "Health",
  geological: "Geological",
};

const COMPONENT_COLORS: Record<string, string> = {
  military: "bg-rose-glow",
  economic: "bg-emerald-glow",
  climate: "bg-sky-400",
  cyber: "bg-fuchsia-400",
  health: "bg-pink-400",
  geological: "bg-orange-400",
};

function TrendIcon({ trend }: { trend: "up" | "stable" | "down" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-rose-glow" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-emerald-glow" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function GlobalRiskIndex({ data }: Props) {
  const meta = RISK_STATUS_META[data.status];

  return (
    <div className={`glass-card border p-4 ${meta.border}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${meta.color}`} />
          <span className="text-sm font-semibold">Global Risk Index</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon trend={data.trend} />
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${meta.bg} ${meta.color} ${meta.border}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="mb-3 flex items-end gap-2">
        <span className={`text-4xl font-bold tabular-nums ${meta.color}`}>{data.score}</span>
        <span className="mb-1 text-muted-foreground text-sm">/ 100</span>
      </div>

      {/* Overall bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className={`h-full rounded-full transition-all ${meta.color.replace("text-", "bg-")}`}
          style={{ width: `${data.score}%` }}
        />
      </div>

      {/* Component breakdown */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Components</div>
        {Object.entries(data.components).map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{COMPONENT_LABELS[key] ?? key}</span>
              <span className="tabular-nums font-medium">{value}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-secondary/40">
              <div
                className={`h-full rounded-full ${COMPONENT_COLORS[key] ?? "bg-primary"}`}
                style={{ width: `${Math.min(100, value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Top threats */}
      {data.topThreats.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Top Threats</div>
          <div className="space-y-1">
            {data.topThreats.map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-[11px]">
                <div className="h-1 w-1 rounded-full bg-rose-glow" />
                <span className="text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div suppressHydrationWarning className="mt-3 border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
        Computed {new Date(data.computedAt).toLocaleTimeString()} · 6 factor model
      </div>
    </div>
  );
}
