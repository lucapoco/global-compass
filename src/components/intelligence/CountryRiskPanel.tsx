/**
 * CountryRiskPanel — enhanced country risk display (top 20).
 *
 * Shows: rank · country name · score bar · label · trend ·
 *        active events · critical alerts · top risk factors
 */
import type { CountryRiskV2 } from "@/services/intelligence/types";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface Props {
  risks: CountryRiskV2[];
  /** Max entries to show before "Show more". Default: 10 */
  initialLimit?: number;
}

// Removed duplicate import — CountryRiskV2 imported above

function barColor(label: string): string {
  switch (label) {
    case "Critical": return "bg-rose-glow";
    case "High":     return "bg-amber-glow";
    case "Medium":   return "bg-cyan-glow";
    default:         return "bg-emerald-glow";
  }
}

function labelColor(label: string): string {
  switch (label) {
    case "Critical": return "text-rose-glow border-rose-glow/40 bg-rose-glow/10";
    case "High":     return "text-amber-glow border-amber-glow/40 bg-amber-glow/10";
    case "Medium":   return "text-cyan-glow border-cyan-glow/30 bg-cyan-glow/10";
    default:         return "text-emerald-glow border-emerald-glow/30 bg-emerald-glow/10";
  }
}

function TrendIcon({ trend }: { trend: CountryRiskV2["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-rose-glow" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-emerald-glow" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function CountryRiskPanel({ risks, initialLimit = 10 }: Props) {
  const display = risks.slice(0, initialLimit);

  if (risks.length === 0) {
    return (
      <div className="glass-card p-4 text-center text-sm text-muted-foreground">
        Risk scores will appear once intelligence data loads.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {display.map((r, idx) => (
        <div key={r.country} className="glass-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 text-right text-[11px] tabular-nums text-muted-foreground">#{idx + 1}</span>
          <Link
            to="/country/$name"
            params={{ name: encodeURIComponent(r.country) }}
            className="text-sm font-semibold hover:text-primary hover:underline"
            title={`Intelligence profile: ${r.country}`}
          >
            {r.country}
          </Link>
            </div>
            <div className="flex items-center gap-2">
              <TrendIcon trend={r.trend} />
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${labelColor(r.label)}`}>
                {r.label}
              </span>
              <span className="w-8 text-right text-sm font-bold tabular-nums">{r.score}</span>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
            <div className={`h-full ${barColor(r.label)}`} style={{ width: `${r.score}%` }} />
          </div>

          {/* Stats row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span>{r.activeEvents} events</span>
            {r.criticalAlerts > 0 && (
              <span className="flex items-center gap-0.5 text-rose-glow">
                <AlertTriangle className="h-3 w-3" /> {r.criticalAlerts} critical
              </span>
            )}
            <span>Confidence {r.confidence}%</span>
          </div>

          {/* Risk factors */}
          {r.topRisks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.topRisks.map((f) => (
                <span key={f} className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {risks.length > initialLimit && (
        <p className="py-1 text-center text-[11px] text-muted-foreground">
          +{risks.length - initialLimit} more countries in the risk index
        </p>
      )}
    </div>
  );
}
