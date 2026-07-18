import { useCallback, useEffect, useState } from "react";
import { FileText, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHero } from "@/components/ui/PageHero";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportGenerator } from "@/components/reports/ReportGenerator";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportDetails } from "@/components/reports/ReportDetails";
import { ExecutiveReportPanel } from "@/components/reports/ExecutiveReportPanel";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import type { GeneratedReport } from "@/types";
import type { ReportGenerationResult } from "@/services/reportService";
import { useT } from "@/i18n";

type Tab = "generate" | "executive" | "saved" | "how";

export function ReportsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("generate");
  const [saved, setSaved] = useState<GeneratedReport[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GeneratedReport | null>(null);
  const [draft, setDraft] = useState<ReportGenerationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    document.title = t("app.pages.reports.metaTitle");
  }, [t]);

  const loadSaved = useCallback(async () => {
    if (!configured) {
      setSaved([]);
      return;
    }
    setLoading(true);
    try {
      setSaved(await supabaseService.listGeneratedReports());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.reportLoadFailed"));
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [configured, t]);

  useEffect(() => {
    if (tab === "saved") void loadSaved();
  }, [tab, loadSaved]);

  async function saveDraft() {
    if (!draft) return;
    if (!configured) {
      toast.error(t("app.toasts.supabaseNotConfigured"));
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
      toast.success(t("app.toasts.reportSaved"));
      setDraft(null);
      setSelected(row);
      setTab("saved");
      void loadSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("app.ui.saveFailed");
      if (/generated_reports|does not exist|relation/i.test(msg)) {
        toast.error(t("app.toasts.reportSchemaMissing"));
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
      toast.success(t("app.toasts.reportDeleted"));
      if (selected?.id === id) setSelected(null);
      void loadSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "executive", label: t("app.pages.reports.tabs.executive"), badge: t("app.pages.reports.tabs.executiveBadge") },
    { id: "generate", label: t("app.pages.reports.tabs.generate") },
    { id: "saved", label: t("app.pages.reports.tabs.saved") },
    { id: "how", label: t("app.pages.reports.tabs.how") },
  ];

  return (
    <div className="page-shell space-y-5">
      <PageHero
        title={t("app.pages.reports.title")}
        subtitle={t("app.pages.reports.subtitle")}
        icon={<FileText className="h-5 w-5" />}
      />

      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => {
              setTab(tabItem.id);
              setSelected(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              tab === tabItem.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabItem.label}
            {tabItem.badge && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {tabItem.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "executive" ? (
        <ExecutiveReportPanel />
      ) : null}

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
            <SectionHeader title={t("app.pages.reports.preview")} subtitle={t("app.pages.reports.previewSubtitle")} />
            {draft ? (
              <ReportDetails report={draft} aiStatus={draft.aiStatus} showSave onSave={() => void saveDraft()} saving={saving} />
            ) : (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title={t("app.pages.reports.emptyDraftTitle")}
                hint={t("app.pages.reports.emptyDraftHint")}
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "saved" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("app.pages.reports.savedTitle")}</h2>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void loadSaved()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {t("app.ui.refresh")}
              </button>
            </div>
            {!configured ? (
              <p className="text-xs text-muted-foreground">{t("app.pages.reports.configureSupabase")}</p>
            ) : loading ? (
              <LoadingSpinner label={t("app.pages.reports.loadingReports")} />
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
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title={t("app.pages.reports.emptySavedTitle")}
                hint={t("app.pages.reports.emptySavedHint")}
              />
            )}
          </div>
          <div className="glass-card p-4">
            {selected ? (
              <ReportDetails report={selected} showSave={false} />
            ) : (
              <EmptyState title={t("app.pages.reports.selectReport")} hint={t("app.pages.reports.selectReportHint")} />
            )}
          </div>
        </div>
      ) : null}

      {tab === "how" ? (
        <div className="glass-card space-y-4 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <Info className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("app.pages.reports.how.title")}</h2>
          </div>
          <section>
            <h3 className="mb-1 font-medium text-foreground">{t("app.pages.reports.how.dataTitle")}</h3>
            <p className="mb-1">{t("app.pages.reports.how.dataIntro")}</p>
            <ul className="list-inside list-disc space-y-1">
              <li>{t("app.pages.reports.how.dataGnews")}</li>
              <li>{t("app.pages.reports.how.dataUsgs")}</li>
              <li>{t("app.pages.reports.how.dataGdacs")}</li>
              <li>{t("app.pages.reports.how.dataAcled")}</li>
              <li>{t("app.pages.reports.how.dataWorldBank")}</li>
              <li>{t("app.pages.reports.how.dataRisk")}</li>
              <li>{t("app.pages.reports.how.dataSupabase")}</li>
              <li>{t("app.pages.reports.how.dataCountries")}</li>
              <li>{t("app.pages.reports.how.dataHealth")}</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">{t("app.pages.reports.how.genTitle")}</h3>
            <p>{t("app.pages.reports.how.genBody")}</p>
          </section>
          <section>
            <h3 className="mb-1 font-medium text-foreground">{t("app.pages.reports.how.limitsTitle")}</h3>
            <ul className="list-inside list-disc space-y-1">
              <li>{t("app.pages.reports.how.limitInvent")}</li>
              <li>{t("app.pages.reports.how.limitDemo")}</li>
              <li>{t("app.pages.reports.how.limitCached")}</li>
              <li>{t("app.pages.reports.how.limitRisk")}</li>
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
