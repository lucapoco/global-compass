import { useCallback, useEffect, useState } from "react";
import { FileText, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportGenerator } from "@/components/reports/ReportGenerator";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportDetails } from "@/components/reports/ReportDetails";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import type { GeneratedReport } from "@/types";
import type { ReportGenerationResult } from "@/services/reportService";

type Tab = "generate" | "saved" | "how";

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("generate");
  const [saved, setSaved] = useState<GeneratedReport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GeneratedReport | null>(null);
  const [draft, setDraft] = useState<ReportGenerationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  const loadSaved = useCallback(async () => {
    if (!configured) {
      setSaved([]);
      return;
    }
    setLoading(true);
    try {
      setSaved(await supabaseService.listGeneratedReports());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load reports");
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (tab === "saved") void loadSaved();
  }, [tab, loadSaved]);

  async function saveDraft() {
    if (!draft) return;
    if (!configured) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    try {
      const row = await supabaseService.saveGeneratedReport({
        title: draft.title,
        type: draft.type,
        country: draft.country ?? null,
        event_id: draft.eventId ?? null,
        content: draft.content,
        data_status: draft.dataStatus,
      });
      toast.success("Report saved.");
      setDraft(null);
      setSelected(row);
      setTab("saved");
      void loadSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      if (/generated_reports|does not exist|relation/i.test(msg)) {
        toast.error("Run supabase-schema.sql to create generated_reports table.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(id: string, title: string) {
    setDeletingId(id);
    try {
      await supabaseService.deleteGeneratedReport(id, title);
      toast.success("Report deleted.");
      if (selected?.id === id) setSelected(null);
      void loadSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: "Generate" },
    { id: "saved", label: "Saved reports" },
    { id: "how", label: "How it works" },
  ];

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 md:p-6">
        <SectionHeader
          title="Intelligence Reports"
          subtitle="Generate structured briefings from live, cached, or demo data already in Global Pulse"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSelected(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-card p-4">
            <ReportGenerator
              onGenerated={(r) => {
                setDraft(r);
                setSelected(null);
              }}
            />
          </div>
          <div className="glass-card p-4">
            <SectionHeader title="Preview" subtitle="Save or export after generation" />
            {draft ? (
              <ReportDetails report={draft} aiStatus={draft.aiStatus} showSave onSave={() => void saveDraft()} saving={saving} />
            ) : (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No report yet"
                description="Choose a report type and click Generate."
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "saved" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Saved reports</h2>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void loadSaved()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
            {!configured ? (
              <p className="text-xs text-muted-foreground">Configure Supabase to save reports.</p>
            ) : loading ? (
              <LoadingSpinner label="Loading reports…" />
            ) : saved?.length ? (
              saved.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onOpen={() => setSelected(r)}
                  onDelete={() => void deleteReport(r.id, r.title)}
                  deleting={deletingId === r.id}
                />
              ))
            ) : (
              <EmptyState icon={<FileText className="h-8 w-8" />} title="No saved reports" description="Generate and save a report first." />
            )}
          </div>
          <div className="glass-card p-4">
            {selected ? (
              <ReportDetails report={selected} showSave={false} />
            ) : (
              <EmptyState title="Select a report" description="Open a saved report to view or print." />
            )}
          </div>
        </div>
      ) : null}

      {tab === "how" ? (
        <div className="glass-card space-y-4 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">How Intelligence Reports work</h2>
          </div>
          <section>
            <h3 className="mb-1 font-medium text-foreground">Data used</h3>
            <ul className="list-inside list-disc space-y-1">
              <li>GNews intelligence headlines (via same-origin proxy)</li>
              <li>USGS earthquakes (last 24h)</li>
              <li>Country Risk Index (heuristic)</li>
              <li>Supabase saved alerts &amp; saved intelligence</li>
              <li>REST Countries metadata (country reports)</li>
              <li>API health / data status labels (LIVE, CACHED, DEMO)</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">How reports are generated</h3>
            <p>
              Global Pulse builds a structured draft from in-app data, then optionally polishes it with{" "}
              <strong className="text-foreground">Global Pulse AI (Google Gemini)</strong> when configured. If Gemini is
              busy or unavailable, a <strong className="text-foreground">local structured fallback</strong> is used —
              still based only on loaded data.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">Limitations</h3>
            <ul className="list-inside list-disc space-y-1">
              <li>Reports never invent headlines, magnitudes, or countries.</li>
              <li>DEMO data is clearly labeled and must not be treated as live breaking news.</li>
              <li>CACHED data reflects previously fetched live headlines, not the open internet.</li>
              <li>Risk scores are educational composites, not official assessments.</li>
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}