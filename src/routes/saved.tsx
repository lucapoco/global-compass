import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { SavedCountry, SavedAlert, ProjectLog } from "@/types";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved Data — Global Pulse" }] }),
  component: SavedPage,
});

function SavedPage() {
  const [countries, setCountries] = useState<SavedCountry[] | null>(null);
  const [alerts, setAlerts] = useState<SavedAlert[] | null>(null);
  const [logs, setLogs] = useState<ProjectLog[] | null>(null);
  const configured = isSupabaseConfigured();

  async function refresh() {
    if (!configured) return;
    try {
      const [c, a, l] = await Promise.all([
        supabaseService.listSavedCountries(),
        supabaseService.listSavedAlerts(),
        supabaseService.listLogs(),
      ]);
      setCountries(c); setAlerts(a); setLogs(l);
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
  }
  useEffect(() => { refresh(); }, []);

  if (!configured) {
    return <EmptyState title="Supabase is not configured yet" hint="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable saved data." />;
  }

  async function delCountry(c: SavedCountry) {
    try { await supabaseService.deleteSavedCountry(c.id, c.country_name); toast.success("Removed."); refresh(); }
    catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  }
  async function delAlert(a: SavedAlert) {
    try { await supabaseService.deleteSavedAlert(a.id, a.title); toast.success("Removed."); refresh(); }
    catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Data</h1>
          <p className="text-xs text-muted-foreground">Stored in your connected Supabase project</p>
        </div>
        <DataBadge variant="live">Supabase connected</DataBadge>
      </div>

      <section>
        <SectionHeader title="Saved Countries" subtitle={countries ? `${countries.length} entries` : ""} />
        {!countries ? <LoadingSpinner /> : countries.length === 0 ? <EmptyState title="No saved countries yet" /> : (
          <div className="grid gap-2 md:grid-cols-2">
            {countries.map((c) => (
              <div key={c.id} className="glass-card flex items-center gap-3 p-3">
                {c.flag_url && <img src={c.flag_url} alt="" className="h-8 w-12 rounded object-cover border border-border/60" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.country_name} <span className="text-[10px] text-muted-foreground">({c.country_code ?? "—"})</span></div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.capital ?? "—"} · {c.region ?? "—"} · {c.population?.toLocaleString() ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{c.created_at && new Date(c.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => delCountry(c)} className="rounded-md border border-rose-glow/30 px-2 py-1 text-rose-glow hover:bg-rose-glow/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Saved Alerts" subtitle={alerts ? `${alerts.length} entries` : ""} />
        {!alerts ? <LoadingSpinner /> : alerts.length === 0 ? <EmptyState title="No saved alerts yet" /> : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm"><SeverityBadge severity={a.severity} /> <span className="truncate">{a.title}</span></div>
                  <div className="text-[11px] text-muted-foreground">{a.type} · {a.source ?? "—"} · {a.location ?? "—"} · {a.created_at && new Date(a.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => delAlert(a)} className="rounded-md border border-rose-glow/30 px-2 py-1 text-rose-glow hover:bg-rose-glow/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Project Logs" subtitle="Recent activity audit trail" />
        {!logs ? <LoadingSpinner /> : logs.length === 0 ? <EmptyState title="No activity yet" /> : (
          <div className="glass-card max-h-64 overflow-auto p-3 text-xs">
            {logs.map((l) => (
              <div key={l.id} className="flex justify-between border-b border-border/30 py-1.5 last:border-0">
                <span className="text-foreground">{l.action} {l.details ? <span className="text-muted-foreground">— {l.details}</span> : null}</span>
                <span className="text-muted-foreground">{l.created_at && new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
