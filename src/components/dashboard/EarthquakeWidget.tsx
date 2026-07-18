/**
 * EarthquakeWidget — Compact seismic activity panel.
 *
 * Right-column widget for the Operations Dashboard.
 * Highlights the largest earthquake and lists recent notable events (M≥4).
 * No additional API calls — data comes from the DashboardSnapshot quakes array.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, MapPin, AlertTriangle } from "lucide-react";
import { useT } from "@/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Earthquake } from "@/types";

function magLevel(mag: number): { label: string; color: string; bg: string } {
  if (mag >= 7) return { label: "Major",    color: "text-rose-400",    bg: "bg-rose-500/15 border-rose-500/30" };
  if (mag >= 6) return { label: "Strong",   color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30" };
  if (mag >= 5) return { label: "Moderate", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30" };
  if (mag >= 4) return { label: "Light",    color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/25" };
  return                { label: "Minor",   color: "text-muted-foreground", bg: "bg-secondary/30 border-border/50" };
}

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

interface Props { quakes: Earthquake[]; }

export function EarthquakeWidget({ quakes }: Props) {
  const t = useT();
  const { largest, notable, totalToday, majorCount } = useMemo(() => {
    const sorted = [...quakes].sort((a, b) => b.magnitude - a.magnitude);
    const largest = sorted[0] ?? null;
    const notable = sorted.filter((q) => q.magnitude >= 4).slice(0, 5);
    const totalToday = quakes.filter((q) => Date.now() - q.time < 86_400_000).length;
    const majorCount = quakes.filter((q) => q.magnitude >= 6).length;
    return { largest, notable, totalToday, majorCount };
  }, [quakes]);

  const level = largest ? magLevel(largest.magnitude) : null;

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title={t("app.pages.dashboard.earthquakeWidget.title")}
        subtitle={t("app.pages.dashboard.earthquakeWidget.subtitle", { count: totalToday })}
        right={majorCount > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] font-bold text-rose-400">
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> {majorCount} MAJOR
          </span>
        ) : <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        size="sm"
      />

      {!largest ? (
        <EmptyState title={t("app.pages.dashboard.earthquakeWidget.emptyTitle")} hint={t("app.pages.dashboard.earthquakeWidget.emptyHint")} compact />
      ) : (
        <div className="space-y-3">
          {/* Largest quake highlight */}
          <div className={`rounded-xl border p-3 ${level!.bg}`}>
            <div className="flex items-center gap-3">
              <div className="text-center flex-shrink-0">
                <div className={`text-3xl font-bold tabular-nums ${level!.color}`}>{largest.magnitude.toFixed(1)}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">magnitude</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${level!.color}`}>{level!.label} Earthquake</div>
                <p className="text-xs font-medium line-clamp-2 leading-snug">{largest.place}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>Depth: {largest.depth.toFixed(0)} km</span><span>·</span><span>{timeAgo(largest.time)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notable list */}
          {notable.length > 1 && (
            <div className="space-y-1">
              <div className="text-label text-muted-foreground mb-1.5">Recent Notable</div>
              {notable.slice(1).map((q) => {
                const lvl = magLevel(q.magnitude);
                return (
                  <div key={q.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-secondary/10 px-2.5 py-2">
                    <span className={`w-8 shrink-0 text-right text-sm font-bold tabular-nums ${lvl.color}`}>{q.magnitude.toFixed(1)}</span>
                    <p className="min-w-0 flex-1 truncate text-xs">{q.place}</p>
                    <span className="text-[9px] text-muted-foreground flex-shrink-0">{timeAgo(q.time)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>USGS · {quakes.length} total records</span>
            </div>
            {largest.url && <a href={largest.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px]" aria-label="View on USGS">USGS →</a>}
          </div>
        </div>
      )}

      <div className="mt-3">
        <Link to="/earthquakes" className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full">
          {t("app.pages.dashboard.earthquakeWidget.fullDashboard")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
