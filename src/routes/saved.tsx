import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, TestTube2, Trash2 } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { SavedSupabaseDebugPanel } from "@/components/debug/SavedSupabaseDebugPanel";
import { getSupabaseViteEnvSummary } from "@/lib/supabaseEnv";
import { supabaseService, isSupabaseConfigured, type SavedTableCountRow } from "@/services/supabaseService";
import type { SavedCountry, SavedAlert, ProjectLog, SavedIntelligence } from "@/types";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved Data — Global Pulse" }] }),
  component: SavedPage,
});

function SavedPage() {
  const [countries, setCountries] = useState<SavedCountry[] | null>(null);
  const [alerts, setAlerts] = useState<SavedAlert[] | null>(null);
  const [intel, setIntel] = useState<SavedIntelligence[] | null>(null);
  const [logs, setLogs] = useState<ProjectLog[] | null>(null);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState<SavedTableCountRow[] | null>(null);

  const configured = isSupabaseConfigured();
  const envMeta = getSupabaseViteEnvSummary();

  const refreshDebugCounts = useCallback(async () => {
    if (!import.meta.env.DEV || !configured) return;
    try {
      setTableCounts(await supabaseService.countSavedDataDebugTableRows());
    } catch {
      setTableCounts(null);
    }
  }, [configured]);

  const refreshListsFromSupabase = useCallback(async () => {
    if (!configured) return;
    setListRefreshing(true);
    try {
      const [c, a, i, l] = await Promise.all([
        supabaseService.listSavedCountries(),
        supabaseService.listSavedAlerts(),
        supabaseService.listSavedIntelligence(),
        supabaseService.listLogs(),
      ]);
      setCountries(c);
      setAlerts(a);
      setIntel(i as SavedIntelligence[]);
      setLogs(l);
      setLastRefreshIso(new Date().toISOString());
      await refreshDebugCounts();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load saved data from Supabase");
    } finally {
      setListRefreshing(false);
    }
  }, [configured, refreshDebugCounts]);

  useEffect(() => {
    void refreshListsFromSupabase();
  }, [refreshListsFromSupabase]);

  async function testConnection() {
    setTestBusy(true);
    try {
      const r = await supabaseService.testSavedDataConnection();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      await refreshDebugCounts();
    } catch (e: any) {
      toast.error(e?.message ?? "Supabase test failed");
    } finally {
      setTestBusy(false);
    }
  }

  if (!configured) {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        hint="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server (Ctrl+C → npm run dev) and hard-refresh."
      />
    );
  }

  async function delCountry(c: SavedCountry) {
    try {
      await supabaseService.deleteSavedCountry(c.id, c.country_name);
      toast.success("Removed.");
      await refreshListsFromSupabase();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }
  async function delAlert(a: SavedAlert) {
    try {
      await supabaseService.deleteSavedAlert(a.id, a.title);
      toast.success("Removed.");
      await refreshListsFromSupabase();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }
  async function delIntel(i: SavedIntelligence) {
    try {
      await supabaseService.deleteSavedIntelligence(i.id, i.title);
      toast.success("Removed.");
      await refreshListsFromSupabase();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Data</h1>
          <p className="text-xs text-muted-foreground">
            Loaded only from Supabase (no local mock).{" "}
            {envMeta.projectRef ? (
              <span className="font-mono text-foreground/80">ref {envMeta.projectRef}</span>
            ) : (
              <span className="text-amber-600">URL host is not *.supabase.co — check VITE_SUPABASE_URL</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={listRefreshing}
            onClick={() => void refreshListsFromSupabase()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listRefreshing ? "animate-spin" : ""}`} />
            Refresh Supabase data
          </button>
          <button
            type="button"
            disabled={testBusy}
            onClick={() => void testConnection()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            Test Supabase connection
          </button>
          <DataBadge variant="live">Supabase</DataBadge>
        </div>
      </div>

      {import.meta.env.DEV && (
        <SavedSupabaseDebugPanel lastRefreshIso={lastRefreshIso} tableCounts={tableCounts} />
      )}

      <section>
        <SectionHeader title="Saved Countries" subtitle={countries ? `${countries.length} entries` : ""} />
        {!countries ? (
          <LoadingSpinner />
        ) : countries.length === 0 ? (
          <EmptyState title="No saved countries yet" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {countries.map((c) => (
              <div key={c.id} className="glass-card flex items-center gap-3 p-3">
                {c.flag_url && (
                  <img src={c.flag_url} alt="" className="h-8 w-12 rounded border border-border/60 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {c.country_name}{" "}
                    <span className="text-[10px] text-muted-foreground">({c.country_code ?? "—"})</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {c.capital ?? "—"} · {c.region ?? "—"} · {c.population?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.created_at && new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => delCountry(c)}
                  className="rounded-md border border-rose-glow/30 px-2 py-1 text-rose-glow hover:bg-rose-glow/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Saved Alerts" subtitle={alerts ? `${alerts.length} entries` : ""} />
        {!alerts ? (
          <LoadingSpinner />
        ) : alerts.length === 0 ? (
          <EmptyState title="No saved alerts yet" />
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <SeverityBadge severity={a.severity} /> <span className="truncate">{a.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.type} · {a.source ?? "—"} · {a.location ?? "—"} ·{" "}
                    {a.created_at && new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => delAlert(a)}
                  className="rounded-md border border-rose-glow/30 px-2 py-1 text-rose-glow hover:bg-rose-glow/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Saved Intelligence" subtitle={intel ? `${intel.length} entries` : ""} />
        {!intel ? (
          <LoadingSpinner />
        ) : intel.length === 0 ? (
          <EmptyState
            title="No saved intelligence yet"
            hint="Open the Intelligence Feed and click Save on any item."
          />
        ) : (
          <div className="space-y-2">
            {intel.map((i) => (
              <div key={i.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {i.category ?? "general"}
                    </span>
                    <SeverityBadge
                      severity={(i.severity ?? "low").charAt(0).toUpperCase() + (i.severity ?? "low").slice(1)}
                    />
                    <span className="truncate">{i.title}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {i.source ?? "—"} · {i.country ?? "—"} ·{" "}
                    {i.published_at && new Date(i.published_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {i.url && (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Open
                    </a>
                  )}
                  <button
                    onClick={() => delIntel(i)}
                    className="rounded-md border border-rose-glow/30 px-2 py-1 text-rose-glow hover:bg-rose-glow/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Project Logs" subtitle="Recent activity audit trail" />
        {!logs ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="glass-card max-h-64 overflow-auto p-3 text-xs">
            {logs.map((l) => (
              <div key={l.id} className="flex justify-between border-b border-border/30 py-1.5 last:border-0">
                <span className="text-foreground">
                  {l.action}{" "}
                  {l.details ? <span className="text-muted-foreground">— {l.details}</span> : null}
                </span>
                <span className="text-muted-foreground">
                  {l.created_at && new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
