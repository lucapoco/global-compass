import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getEarthquakes, magnitudeSeverity } from "@/services/earthquakesApi";
import { fetchIntelligence } from "@/services/newsApi";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import { demoAlerts } from "@/data/demoAlerts";
import type { AlertItem, SavedAlert, IntelligenceSeverity, Severity } from "@/types";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Global Alerts — Global Pulse" }] }),
  component: AlertsPage,
});

const TYPES = ["all", "earthquake", "intelligence", "weather", "infrastructure", "saved"] as const;

const intelToSeverity: Record<IntelligenceSeverity, Severity> = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
};

function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [saved, setSaved] = useState<SavedAlert[]>([]);
  const [filter, setFilter] = useState<(typeof TYPES)[number]>("all");

  useEffect(() => {
    (async () => {
      const list: AlertItem[] = [];
      try {
        const quakes = await getEarthquakes("day");
        for (const q of quakes.filter((q) => q.magnitude >= 4.5).slice(0, 30)) {
          list.push({
            id: q.id, title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
            type: "earthquake", severity: magnitudeSeverity(q.magnitude),
            location: `${q.latitude.toFixed(2)}, ${q.longitude.toFixed(2)}`,
            description: `Depth ${q.depth.toFixed(1)} km`, source: "USGS", time: q.time,
          });
        }
      } catch {}

      try {
        const news = await fetchIntelligence({ max: 30 });
        for (const n of news.items.filter((n) => n.severity === "high" || n.severity === "critical")) {
          list.push({
            id: `intel-${n.id}`,
            title: n.title,
            type: "intelligence",
            severity: intelToSeverity[n.severity],
            location: n.country,
            description: n.description,
            source: n.isLive ? n.source : "Demo",
          });
        }
      } catch {}

      for (const d of demoAlerts) list.push(d);
      setAlerts(list);

      if (isSupabaseConfigured()) {
        try { setSaved(await supabaseService.listSavedAlerts()); } catch {}
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    if (filter === "saved") return [];
    if (filter === "all") return alerts;
    return alerts.filter((a) => a.type === filter);
  }, [alerts, filter]);

  async function persist(a: AlertItem) {
    if (!isSupabaseConfigured()) { toast.error("Connect Supabase to save alerts."); return; }
    try {
      await supabaseService.saveAlert({
        title: a.title, type: a.type, severity: a.severity,
        location: a.location ?? null, description: a.description ?? null, source: a.source,
      });
      toast.success("Saved to alerts.");
      setSaved(await supabaseService.listSavedAlerts());
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Global Alerts</h1>
          <p className="text-xs text-muted-foreground">Significant earthquakes (M≥4.5), saved alerts and demo signals</p>
        </div>
        <div className="flex gap-2"><DataBadge variant="source">USGS · Supabase</DataBadge><DataBadge variant="live">Live</DataBadge></div>
      </div>

      <div className="glass-card flex flex-wrap gap-2 p-3 text-xs">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-md border px-3 py-1.5 capitalize ${filter === t ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {!alerts && <LoadingSpinner />}

      {filter === "saved" ? (
        <div className="space-y-2">
          {saved.length === 0 ? <div className="text-xs text-muted-foreground">No saved alerts.</div> :
            saved.map((s) => (
              <div key={s.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <div className="flex items-center gap-2 text-sm"><SeverityBadge severity={s.severity} /> {s.title}</div>
                  <div className="text-[11px] text-muted-foreground">{s.type} · {s.source} · {s.location ?? "—"}</div>
                </div>
                <DataBadge variant="source">Supabase</DataBadge>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm"><SeverityBadge severity={a.severity} /> <span className="truncate">{a.title}</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">{a.type} · {a.source}{a.location ? ` · ${a.location}` : ""}{a.description ? ` · ${a.description}` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <DataBadge variant={a.source === "Demo" ? "demo" : "source"}>{a.source}</DataBadge>
                <button onClick={() => persist(a)} className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  <Bookmark className="h-3 w-3" /> Save
                </button>
              </div>
            </div>
          ))}
          {alerts && filtered.length === 0 && <div className="text-xs text-muted-foreground">No alerts for this filter.</div>}
        </div>
      )}
    </div>
  );
}
