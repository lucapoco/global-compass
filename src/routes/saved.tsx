/**
 * Saved Data — countries, alerts, intelligence (no project logs).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, FolderPlus, LogIn, RefreshCw, TestTube2, Trash2 } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Button } from "@/components/ui/button";
import { AddToCollectionModal, type CollectionArticlePayload } from "@/components/collections/AddToCollectionModal";
import { getSupabaseViteEnvSummary } from "@/lib/supabaseEnv";
import { sanitizeUrl } from "@/lib/utils";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { SavedCountry, SavedAlert, SavedIntelligence } from "@/types";
import { useT } from "@/i18n";
import { useAuth } from "@/auth";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved Data — Global Pulse" }] }),
  component: SavedPage,
});

function SavedPage() {
  const t = useT();
  const { isAuthenticated, openAuthModal, loading: authLoading } = useAuth();
  const [countries, setCountries] = useState<SavedCountry[] | null>(null);
  const [alerts, setAlerts] = useState<SavedAlert[] | null>(null);
  const [intel, setIntel] = useState<SavedIntelligence[] | null>(null);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [addTarget, setAddTarget] = useState<CollectionArticlePayload | null>(null);

  const configured = isSupabaseConfigured();
  const envMeta = getSupabaseViteEnvSummary();

  const refreshListsFromSupabase = useCallback(async () => {
    if (!configured || !isAuthenticated) return;
    setListRefreshing(true);
    try {
      const [c, a, i] = await Promise.all([
        supabaseService.listSavedCountries(),
        supabaseService.listSavedAlerts(),
        supabaseService.listSavedIntelligence(),
      ]);
      setCountries(c);
      setAlerts(a);
      setIntel(i as SavedIntelligence[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.savedDataLoadFailed"));
    } finally {
      setListRefreshing(false);
    }
  }, [configured, isAuthenticated, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshListsFromSupabase();
  }, [refreshListsFromSupabase, isAuthenticated]);

  async function testConnection() {
    setTestBusy(true);
    try {
      const r = await supabaseService.testSavedDataConnection();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.supabaseTestFailed"));
    } finally {
      setTestBusy(false);
    }
  }

  if (authLoading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <Bookmark className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">{t("app.pages.saved.title")}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t("app.auth.gate.savedData")}</p>
          <Button onClick={() => openAuthModal("saved_data")}>
            <LogIn className="mr-1.5 h-4 w-4" />
            {t("app.auth.signIn")}
          </Button>
          <Link to="/dashboard" className="text-sm text-primary hover:underline">
            {t("app.auth.continueBrowsing")}
          </Link>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <EmptyState
        title={t("app.pages.saved.notConfiguredTitle")}
        hint={t("app.pages.saved.notConfiguredHint")}
      />
    );
  }

  async function delCountry(c: SavedCountry) {
    try {
      await supabaseService.deleteSavedCountry(c.id, c.country_name);
      toast.success(t("app.toasts.removed"));
      setCountries((prev) => (prev ? prev.filter((x) => x.id !== c.id) : prev));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.deleteFailed"));
    }
  }
  async function delAlert(a: SavedAlert) {
    try {
      await supabaseService.deleteSavedAlert(a.id, a.title);
      toast.success(t("app.toasts.removed"));
      setAlerts((prev) => (prev ? prev.filter((x) => x.id !== a.id) : prev));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.deleteFailed"));
    }
  }
  async function delIntel(i: SavedIntelligence) {
    try {
      await supabaseService.deleteSavedIntelligence(i.id, i.title);
      toast.success(t("app.toasts.removed"));
      setIntel((prev) => (prev ? prev.filter((x) => x.id !== i.id) : prev));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.deleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.pages.saved.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("app.pages.saved.subtitle")}{" "}
            {envMeta.projectRef ? (
              <span className="font-mono text-foreground/80">ref {envMeta.projectRef}</span>
            ) : (
              <span className="text-amber-600">{t("app.pages.saved.urlHostWarning")}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/collections">{t("app.nav.collections")}</Link>
          </Button>
          <button
            type="button"
            disabled={listRefreshing}
            onClick={() => void refreshListsFromSupabase()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listRefreshing ? "animate-spin" : ""}`} />
            {t("app.pages.saved.refresh")}
          </button>
          <button
            type="button"
            disabled={testBusy}
            onClick={() => void testConnection()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            {t("app.pages.saved.testConnection")}
          </button>
          <DataBadge variant="live">Supabase</DataBadge>
        </div>
      </div>

      <section>
        <SectionHeader
          title={t("app.pages.saved.countriesTitle")}
          subtitle={countries ? t("app.pages.saved.entries", { count: countries.length }) : ""}
        />
        {!countries ? (
          <LoadingSpinner />
        ) : countries.length === 0 ? (
          <EmptyState title={t("app.pages.saved.emptyCountries")} />
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
                </div>
                <button
                  type="button"
                  onClick={() => void delCountry(c)}
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
        <SectionHeader
          title={t("app.pages.saved.alertsTitle")}
          subtitle={alerts ? t("app.pages.saved.entries", { count: alerts.length }) : ""}
        />
        {!alerts ? (
          <LoadingSpinner />
        ) : alerts.length === 0 ? (
          <EmptyState title={t("app.pages.saved.emptyAlerts")} />
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <SeverityBadge severity={a.severity} /> <span className="truncate">{a.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.type} · {a.source ?? "—"} · {a.location ?? "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void delAlert(a)}
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
        <SectionHeader
          title={t("app.pages.saved.intelTitle")}
          subtitle={intel ? t("app.pages.saved.entries", { count: intel.length }) : ""}
        />
        {!intel ? (
          <LoadingSpinner />
        ) : intel.length === 0 ? (
          <EmptyState
            title={t("app.pages.saved.emptyIntel")}
            hint={t("app.pages.saved.emptyIntelHint")}
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
                    {i.source ?? "—"} · {i.country ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAddTarget({
                        article_id: i.id,
                        title: i.title,
                        url: i.url,
                        source: i.source,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <FolderPlus className="h-3 w-3" />
                    {t("app.pages.collections.addToCollection")}
                  </button>
                  {sanitizeUrl(i.url) && (
                    <a
                      href={sanitizeUrl(i.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {t("app.pages.saved.open")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void delIntel(i)}
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

      <AddToCollectionModal
        open={!!addTarget}
        article={addTarget}
        onClose={() => setAddTarget(null)}
      />
    </div>
  );
}
