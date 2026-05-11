import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bookmark, ExternalLink } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { EarthquakeMagnitudeChart } from "@/components/charts/EarthquakeMagnitudeChart";
import { getEarthquakes, magnitudeSeverity } from "@/services/earthquakesApi";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { Earthquake } from "@/types";

export const Route = createFileRoute("/earthquakes")({
  head: () => ({ meta: [{ title: "Earthquakes — Global Pulse" }] }),
  component: EarthquakesPage,
});

function EarthquakesPage() {
  const [range, setRange] = useState<"day" | "week">("day");
  const [data, setData] = useState<Earthquake[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minMag, setMinMag] = useState(0);
  const [sort, setSort] = useState<"new" | "mag">("new");
  const [highOnly, setHighOnly] = useState(false);

  useEffect(() => {
    setData(null); setError(null);
    getEarthquakes(range).then(setData).catch((e) => setError(e.message ?? "Failed"));
  }, [range]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let arr = data.filter((q) => q.magnitude >= minMag);
    if (highOnly) arr = arr.filter((q) => q.magnitude >= 5);
    arr = arr.sort((a, b) => sort === "new" ? b.time - a.time : b.magnitude - a.magnitude);
    return arr;
  }, [data, minMag, sort, highOnly]);

  async function saveAsAlert(q: Earthquake) {
    if (!isSupabaseConfigured()) { toast.error("Connect Supabase to save alerts."); return; }
    try {
      await supabaseService.saveAlert({
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        type: "earthquake",
        severity: magnitudeSeverity(q.magnitude),
        location: `${q.latitude.toFixed(3)},${q.longitude.toFixed(3)}`,
        description: `Depth ${q.depth.toFixed(1)} km · ${new Date(q.time).toLocaleString()}`,
        source: "USGS",
      });
      toast.success("Saved to alerts.");
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Earthquakes</h1>
          <p className="text-xs text-muted-foreground">Live seismic data from USGS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataBadge variant="source">USGS</DataBadge>
          <DataBadge variant="live">Live</DataBadge>
        </div>
      </div>

      <div className="glass-card flex flex-wrap items-center gap-2 p-3 text-xs">
        <div className="flex rounded-md border border-border/60 p-0.5">
          {(["day", "week"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded px-3 py-1 ${range === r ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              Last {r}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          Min magnitude
          <input type="number" step="0.5" value={minMag} onChange={(e) => setMinMag(parseFloat(e.target.value) || 0)} className="w-16 rounded border border-border/60 bg-background/60 px-2 py-1" />
        </label>
        <button onClick={() => setSort("new")} className={`rounded-md border px-3 py-1 ${sort === "new" ? "border-primary/40 text-primary" : "border-border/60 text-muted-foreground"}`}>Newest</button>
        <button onClick={() => setSort("mag")} className={`rounded-md border px-3 py-1 ${sort === "mag" ? "border-primary/40 text-primary" : "border-border/60 text-muted-foreground"}`}>Highest magnitude</button>
        <button onClick={() => setHighOnly((v) => !v)} className={`rounded-md border px-3 py-1 ${highOnly ? "border-amber-glow/40 text-amber-glow" : "border-border/60 text-muted-foreground"}`}>High severity only</button>
      </div>

      {error && <ErrorMessage message={error} />}
      {!data && !error && <LoadingSpinner />}

      {data && (
        <>
          <div className="glass-card p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Magnitude distribution</div>
            <EarthquakeMagnitudeChart data={filtered} />
          </div>

          <div className="space-y-2">
            {filtered.slice(0, 60).map((q) => {
              const sev = magnitudeSeverity(q.magnitude);
              return (
                <div key={q.id} className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-amber-glow">M{q.magnitude.toFixed(1)}</span>
                      <SeverityBadge severity={sev} />
                      <span className="truncate text-sm">{q.place}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(q.time).toLocaleString()} · depth {q.depth.toFixed(1)} km · {q.latitude.toFixed(2)}, {q.longitude.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveAsAlert(q)} className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      <Bookmark className="h-3 w-3" /> Save alert
                    </button>
                    {q.url && (
                      <a href={q.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> USGS
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground">No earthquakes match your filters.</div>}
          </div>
        </>
      )}
    </div>
  );
}
