import { Link } from "@tanstack/react-router";
import type { CountryRisk } from "@/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";

function barColor(label: string) {
  switch (label) {
    case "Critical": return "bg-rose-glow";
    case "High": return "bg-amber-glow";
    case "Medium": return "bg-cyan-glow";
    default: return "bg-emerald-glow";
  }
}

export function RiskScoreCard({ rank, risk }: { rank: number; risk: CountryRisk }) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">#{rank}</span>
          <Link
            to="/countries"
            search={{ q: risk.country } as any}
            className="text-sm font-semibold hover:text-primary hover:underline"
            title={`Open ${risk.country}`}
          >
            {risk.country}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={risk.label} />
          <span className="tabular-nums text-base font-semibold">{risk.score}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
        <div className={`h-full ${barColor(risk.label)}`} style={{ width: `${risk.score}%` }} />
      </div>
      {risk.factors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {risk.factors.map((f) => (
            <span key={f} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
