import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Bookmark, Eye } from "lucide-react";
import { toast } from "sonner";
import type { Earthquake, IntelligenceItem, SavedAlert } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { magnitudeSeverity } from "@/services/earthquakesApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";

type Signal =
  | { kind: "intel"; item: IntelligenceItem; time: number }
  | { kind: "quake"; quake: Earthquake; time: number }
  | { kind: "alert"; alert: SavedAlert; time: number };

interface Props {
  intel: IntelligenceItem[];
  quakes: Earthquake[];
  saved: SavedAlert[];
}

const SEV_COLOR: Record<string, string> = {
  critical: "border-rose-glow/40 text-rose-glow",
  high: "border-amber-glow/40 text-amber-glow",
  Critical: "border-rose-glow/40 text-rose-glow",
  High: "border-amber-glow/40 text-amber-glow",
};

export function CriticalSignalsPanel({ intel, quakes, saved }: Props) {
  const [active, setActive] = useState<IntelligenceItem | null>(null);

  const signals = useMemo<Signal[]>(() => {
    const list: Signal[] = [];
    for (const i of intel) {
      if (i.severity === "critical" || i.severity === "high") {
        list.push({ kind: "intel", item: i, time: new Date(i.publishedAt).getTime() });
      }
    }
    for (const q of quakes) {
      if (q.magnitude >= 5) list.push({ kind: "quake", quake: q, time: q.time });
    }
    for (const a of saved) {
      if (a.severity === "Critical") list.push({ kind: "alert", alert: a, time: a.created_at ? new Date(a.created_at).getTime() : Date.now() });
    }
    return list.sort((a, b) => b.time - a.time).slice(0, 8);
  }, [intel, quakes, saved]);

  async function save(i: IntelligenceItem) {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    try { await supabaseService.saveIntelligence(i); toast.success("Saved."); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title="Critical Signals"
        subtitle="Most urgent live events right now"
        right={<AlertTriangle className="h-4 w-4 text-rose-glow" />}
      />

      {signals.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground">
          No critical or high signals detected.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-auto pr-1">
          {signals.map((s, idx) => {
            if (s.kind === "intel") {
              const i = s.item;
              return (
                <div key={`i-${i.id}-${idx}`} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/20 p-2">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEV_COLOR[i.severity]}`}>
                    {i.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setActive(i)} className="line-clamp-2 text-left text-xs font-medium hover:text-primary">{i.title}</button>
                    <div className="text-[10px] text-muted-foreground">{i.source} · {i.category}{i.country ? ` · ${i.country}` : ""} · {new Date(i.publishedAt).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setActive(i)} title="Details" className="rounded border border-border/50 p-1 hover:text-primary"><Eye className="h-3 w-3" /></button>
                    {i.url && <a href={i.url} target="_blank" rel="noreferrer" title="Open" className="rounded border border-border/50 p-1 hover:text-primary"><ExternalLink className="h-3 w-3" /></a>}
                    <button onClick={() => save(i)} title="Save" className="rounded border border-primary/40 bg-primary/10 p-1 text-primary"><Bookmark className="h-3 w-3" /></button>
                  </div>
                </div>
              );
            }
            if (s.kind === "quake") {
              const q = s.quake;
              const sev = magnitudeSeverity(q.magnitude);
              return (
                <div key={`q-${q.id}`} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/20 p-2">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEV_COLOR[sev]}`}>{sev}</span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-medium">M{q.magnitude.toFixed(1)} — {q.place}</div>
                    <div className="text-[10px] text-muted-foreground">USGS · earthquake · depth {q.depth.toFixed(1)} km · {new Date(q.time).toLocaleTimeString()}</div>
                  </div>
                  {q.url && <a href={q.url} target="_blank" rel="noreferrer" title="Open USGS" className="rounded border border-border/50 p-1 hover:text-primary"><ExternalLink className="h-3 w-3" /></a>}
                </div>
              );
            }
            const a = s.alert;
            return (
              <div key={`a-${a.id}`} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/20 p-2">
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEV_COLOR[a.severity] ?? "border-border/60 text-muted-foreground"}`}>{a.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs font-medium">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">{a.type} · {a.source ?? "saved"}{a.location ? ` · ${a.location}` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <IntelligenceDetailsModal item={active} onClose={() => setActive(null)} onSave={save} />
    </div>
  );
}
