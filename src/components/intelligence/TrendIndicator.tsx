/**
 * TrendIndicator — GP-012 display component.
 *
 * Renders a compact or expanded trend indicator for the result
 * produced by `trendAnalyzer.analyzeTrends()`.
 *
 * Compact mode: icon + label (used inline in dashboards).
 * Full mode: direction, magnitude, confidence bar, explanation,
 *            factor list, and per-category breakdown.
 */
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { GlobalTrend, TrendDirection } from "@/services/analytics/trendAnalyzer";

// ─── Style helpers ────────────────────────────────────────────────────────────

function dirStyle(dir: TrendDirection) {
  if (dir === "increasing") return {
    color: "text-rose-glow",
    bg: "bg-rose-500/10 border-rose-500/30",
    Icon: TrendingUp,
    arrow: ArrowUpRight,
  };
  if (dir === "improving") return {
    color: "text-emerald-glow",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    Icon: TrendingDown,
    arrow: ArrowDownRight,
  };
  return {
    color: "text-amber-glow",
    bg: "bg-amber-500/10 border-amber-500/30",
    Icon: Minus,
    arrow: Minus,
  };
}

// ─── Compact badge ────────────────────────────────────────────────────────────

export function TrendBadge({ direction, label }: { direction: TrendDirection; label: string }) {
  const { color, bg, Icon } = dirStyle(direction);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${bg} ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Full panel ───────────────────────────────────────────────────────────────

interface TrendPanelProps {
  trend: GlobalTrend;
  compact?: boolean;
}

export function TrendPanel({ trend, compact = false }: TrendPanelProps) {
  const { color, bg, Icon } = dirStyle(trend.direction);

  const confColor = trend.confidence >= 70 ? "bg-emerald-500" : trend.confidence >= 40 ? "bg-amber-500" : "bg-rose-500";

  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border p-3 ${bg}`}>
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div>
          <div className={`text-sm font-semibold ${color}`}>{trend.label}</div>
          <div className="text-[10px] text-muted-foreground">{trend.magnitude} · {trend.confidence}% confidence</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${bg}`}>
        <Icon className={`mt-0.5 h-7 w-7 shrink-0 ${color}`} />
        <div className="flex-1">
          <div className={`text-lg font-semibold ${color}`}>{trend.label}</div>
          <p className="mt-1 text-sm text-muted-foreground">{trend.explanation}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Confidence</span>
              <span>{trend.confidence}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full transition-all ${confColor}`} style={{ width: `${trend.confidence}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricBox label="Recent (6h)" value={trend.metrics.recentCount} sub="events" />
        <MetricBox label="Baseline (18h)" value={trend.metrics.baselineCount} sub="events" />
        <MetricBox label="Critical (6h)" value={trend.metrics.recentCritical} sub="events" color="text-rose-glow" />
      </div>

      {/* Factors */}
      {trend.factors.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Contributing factors</div>
          <ul className="space-y-1">
            {trend.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${color.replace("text-", "bg-")}`} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category breakdown */}
      {trend.byCategory.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Sector trends</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {trend.byCategory.map((cat) => {
              const s = dirStyle(cat.direction);
              const CatIcon = s.Icon;
              return (
                <div key={cat.category} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${s.bg}`}>
                  <CatIcon className={`h-3.5 w-3.5 shrink-0 ${s.color}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium capitalize">{cat.category}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{cat.explanation}</div>
                  </div>
                  <span className={`ml-auto shrink-0 text-xs font-bold tabular-nums ${s.color}`}>
                    {cat.recentCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, sub, color = "text-foreground" }: {
  label: string; value: number; sub: string; color?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-2.5 text-center">
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}
