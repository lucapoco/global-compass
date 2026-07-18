import { useMemo } from "react";
import { Activity, Newspaper, AlertTriangle, Globe2 } from "lucide-react";
import type { Earthquake, IntelligenceItem, SavedAlert } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useT } from "@/i18n";

interface Props {
  intel: IntelligenceItem[];
  quakes: Earthquake[];
  saved: SavedAlert[];
}

type Row = { id: string; title: string; sub: string; time: number; kind: "intel" | "quake" | "alert"; sev: string };

export function WorldActivityTimeline({ intel, quakes, saved }: Props) {
  const t = useT();
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const i of intel.slice(0, 30)) list.push({
      id: `i-${i.id}`, title: i.title, sub: `${i.source} · ${i.category}${i.country ? ` · ${i.country}` : ""}`,
      time: new Date(i.publishedAt).getTime(), kind: "intel", sev: i.severity,
    });
    for (const q of quakes.slice(0, 30)) list.push({
      id: `q-${q.id}`, title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
      sub: t("app.pages.dashboard.timeline.quakeSub", { depth: q.depth.toFixed(1) }),
      time: q.time, kind: "quake", sev: q.magnitude >= 6 ? "critical" : q.magnitude >= 5 ? "high" : q.magnitude >= 4 ? "medium" : "low",
    });
    for (const a of saved.slice(0, 20)) list.push({
      id: `a-${a.id}`, title: a.title,
      sub: `${a.type} · ${a.source ?? t("app.pages.dashboard.timeline.savedFallback")}${a.location ? ` · ${a.location}` : ""}`,
      time: a.created_at ? new Date(a.created_at).getTime() : Date.now(), kind: "alert", sev: a.severity.toLowerCase(),
    });
    return list.sort((a, b) => b.time - a.time).slice(0, 20);
  }, [intel, quakes, saved, t]);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title={t("app.pages.dashboard.timeline.title")}
        subtitle={t("app.pages.dashboard.timeline.subtitle")}
        right={<Globe2 className="h-4 w-4 text-cyan-glow" />}
      />
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground">{t("app.pages.dashboard.timeline.empty")}</div>
      ) : (
        <div className="panel-scroll space-y-1.5 pr-1" role="list">
          {rows.map((r) => {
            const Icon = r.kind === "intel" ? Newspaper : r.kind === "quake" ? Activity : AlertTriangle;
            const dotColor = r.sev === "critical" ? "bg-rose-glow" : r.sev === "high" ? "bg-amber-glow" : r.sev === "medium" ? "bg-cyan-glow" : "bg-emerald-glow";
            return (
              <div key={r.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5">
                <div className="mt-0.5 flex flex-col items-center">
                  <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                </div>
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs font-medium">{r.title}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{r.sub}</div>
                </div>
                <span suppressHydrationWarning className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{new Date(r.time).toLocaleTimeString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
