/**
 * Intelligence — Global Intelligence Engine page.
 *
 * Replaces the simple news feed with a full intelligence platform:
 *   • Entity extraction · multi-category detection · importance scoring
 *   • Event clustering (multiple articles → single IntelligenceEvent)
 *   • Country Risk Engine (top 20) · Global Risk Index
 *   • Professional timeline (Today / Yesterday / Older)
 *   • Full filter engine + instant search
 *   • Related events navigation · AI Explain (Gemini)
 *
 * Data flow: newsApi.fetchIntelligence() → IntelligenceEngine → IntelligenceEvent[]
 * All existing newsApi/Supabase code is unchanged — the engine is a pure layer on top.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Radio, RefreshCw, LayoutGrid, List, ShieldAlert,
  Brain, Activity, Cpu, TrendingUp,
} from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/button";

// Intelligence Engine
import { runIntelligenceEngine, applyIntelligenceFilter, sortEvents } from "@/services/intelligence/engines/IntelligenceEngine";
import type { ProcessedIntelligence, IntelligenceFilter, IntelligenceEvent, SortMode } from "@/services/intelligence/types";
import { DEFAULT_FILTER } from "@/services/intelligence/types";

// New UI components
import { IntelligenceEventCard } from "@/components/intelligence/IntelligenceEventCard";
import { IntelligenceTimeline } from "@/components/intelligence/IntelligenceTimeline";
import { GlobalRiskIndex } from "@/components/intelligence/GlobalRiskIndex";
import { CountryRiskPanel } from "@/components/intelligence/CountryRiskPanel";
import { IntelligenceEngineFilters } from "@/components/intelligence/IntelligenceEngineFilters";
import { EventDetailsDrawer } from "@/components/intelligence/EventDetailsDrawer";

// Centralized Intelligence Store — every provider (GNews, USGS, GDACS,
// ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS, World Bank, ...), not just GNews.
import { getLatestEvents, invalidateIntelligenceStore } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes } from "@/domain/adapters/legacyIntelAdapter";
import type { NewsStatus } from "@/services/newsApi";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { SavedAlert } from "@/types";
import { useT } from "@/i18n";
import { useAuth } from "@/auth";
import { saveArticle } from "@/services/personalizationService";
import en from "@/locales/en.json";

export const Route = createFileRoute("/intelligence")({
  head: () => ({
    meta: [
      { title: en.app.pages.intelligence.metaTitle },
      { name: "description", content: en.app.pages.intelligence.metaDescription },
    ],
  }),
  component: IntelligencePage,
});

const REFRESH_COOLDOWN_MS = 60_000;
const INITIAL_VISIBLE = 24;
const LOAD_MORE_STEP = 12;

function statusLabel(s: NewsStatus, t: ReturnType<typeof useT>, msg?: string): string {
  if (s === "rate_limited" && msg?.toLowerCase().includes("quota")) return t("app.pages.intelligence.statusQuota");
  const m: Record<NewsStatus, string> = {
    live: t("app.pages.intelligence.statusLive"),
    cached: t("app.pages.intelligence.statusCached"),
    rate_limited: t("app.pages.intelligence.statusRateLimited"),
    error: t("app.pages.intelligence.statusError"),
    demo: t("app.pages.intelligence.statusDemo"),
  };
  return m[s] ?? t("app.pages.intelligence.statusDemo");
}
function statusVariant(s: NewsStatus): "live" | "demo" | "error" | "neutral" {
  if (s === "live") return "live";
  if (s === "cached") return "neutral";
  if (s === "rate_limited" || s === "error") return "error";
  return "demo";
}

function IntelligencePage() {
  const t = useT();
  const { requireAuth } = useAuth();
  const navigate = useNavigate();

  // ─── Raw data state ──────────────────────────────────────────────────────────
  const [newsStatus, setNewsStatus] = useState<NewsStatus>("demo");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [newsSource, setNewsSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(new Date());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  // ─── Engine state ────────────────────────────────────────────────────────────
  const [processed, setProcessed] = useState<ProcessedIntelligence | null>(null);
  const previousProcessed = useRef<ProcessedIntelligence | null>(null);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<IntelligenceFilter>(DEFAULT_FILTER);
  const [sortMode, setSortMode] = useState<SortMode>("importance");
  const [layout, setLayout] = useState<"compact" | "detailed">("compact");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");

  // ─── Selection state ─────────────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<IntelligenceEvent | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Tick timer for cooldown
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset visible count on filter change
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE); }, [filter, sortMode]);

  // ─── Load function ───────────────────────────────────────────────────────────
  const load = useCallback(async (opts?: { force?: boolean }) => {
    setLoading(true);
    if (opts?.force) setProcessed(null);

    try {
      // Single shared load from the centralized Intelligence Store — spans
      // every active provider, not just GNews/USGS.
      const [events, savedAlerts] = await Promise.all([
        getLatestEvents({ force: opts?.force, limit: 200 }),
        isSupabaseConfigured()
          ? supabaseService.listSavedAlerts().catch((): SavedAlert[] => [])
          : Promise.resolve([] as SavedAlert[]),
      ]);

      const items = toIntelligenceItems(events);
      const quakes = toEarthquakes(events);
      const status: NewsStatus = events.some((e) => e.live) ? "live" : events.length > 0 ? "cached" : "demo";

      setNewsStatus(status);
      setStatusMsg(undefined);
      setNewsSource("Global Pulse Intelligence Engine");
      setUpdated(new Date());

      // Run the intelligence engine (pure processing, no network)
      const result = runIntelligenceEngine({
        items,
        quakes,
        savedAlerts,
        previousRisk: previousProcessed.current ?? undefined,
      });

      previousProcessed.current = result;
      setProcessed(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ─── Refresh handler ─────────────────────────────────────────────────────────
  function handleRefresh() {
    if (loading || nowTick < cooldownUntil) {
      if (nowTick < cooldownUntil) toast.message(t("app.ui.pleaseWaitRefresh"));
      return;
    }
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    void load({ force: true });
  }

  // ─── Filtered + sorted events ─────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!processed) return [];
    return applyIntelligenceFilter(processed.events, filter);
  }, [processed, filter]);

  const sortedEvents = useMemo(() => sortEvents(filteredEvents, sortMode), [filteredEvents, sortMode]);
  const displayedEvents = useMemo(() => sortedEvents.slice(0, visibleCount), [sortedEvents, visibleCount]);

  // ─── Derived filter options ───────────────────────────────────────────────────
  const availableCountries = useMemo(() => {
    if (!processed) return [];
    return [...new Set(processed.events.map((e) => e.country).filter(Boolean) as string[])].sort();
  }, [processed]);

  const availableSources = useMemo(() => {
    if (!processed) return [];
    return [...new Set(processed.events.map((e) => e.source))].sort();
  }, [processed]);

  // ─── Severity counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const r = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const ev of filteredEvents) r[ev.severity]++;
    return r;
  }, [filteredEvents]);

  // ─── Related events for selected event ───────────────────────────────────────
  const relatedEvents = useMemo(() => {
    if (!selectedEvent || !processed) return [];
    return processed.events.filter((e) => selectedEvent.relatedEventIds.includes(e.id));
  }, [selectedEvent, processed]);

  // ─── Save handler ─────────────────────────────────────────────────────────────
  function handleSave(ev: IntelligenceEvent) {
    requireAuth(() => {
      void (async () => {
        if (!isSupabaseConfigured()) { toast.error(t("app.toasts.supabaseNotConfigured")); return; }
        try {
          await saveArticle({
            article_id: ev.id,
            title: ev.title,
            summary: ev.summary,
            category: ev.category as string,
            severity: ev.severity,
            country: ev.country,
            source: ev.source,
            url: ev.url,
            image_url: ev.imageUrl,
            published_at: ev.publishedAt,
          });
          const legacyItem = {
            id: ev.id,
            title: ev.title,
            description: ev.summary,
            category: (ev.category as string) as import("@/types").IntelligenceCategory,
            severity: ev.severity as import("@/types").IntelligenceSeverity,
            country: ev.country,
            source: ev.source,
            url: ev.url,
            imageUrl: ev.imageUrl,
            publishedAt: ev.publishedAt,
            isLive: ev.isLive,
            latitude: ev.coordinates?.lat,
            longitude: ev.coordinates?.lng,
          };
          try { await supabaseService.saveIntelligence(legacyItem); } catch { /* optional legacy */ }
          toast.success(t("app.toasts.eventSavedSupabase"));
        } catch (e) { toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")); }
      })();
    }, "save_article");
  }

  // ─── Locate on map ───────────────────────────────────────────────────────────
  function handleLocate(ev: IntelligenceEvent) {
    if (ev.country) {
      void navigate({ to: "/map", search: { q: ev.country } as Record<string, unknown> });
    }
  }

  // ─── AI Explain ──────────────────────────────────────────────────────────────
  async function handleAI(ev: IntelligenceEvent) {
    setSelectedEvent(ev);
    setAiLoading(true);
    try {
      const prompt = `Analyze this global event: "${ev.title}". Provide: 1) A concise summary of what happened, 2) Why it matters geopolitically, 3) Potential consequences. Country: ${ev.country ?? "Unknown"}. Category: ${ev.category}. Be factual and brief.`;
      const res = await fetch("/api/ai-news-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: { dataStatus: { news: "live", earthquakes: "live", supabase: "na", overall: "live" }, newsSource: ev.source, lastUpdated: ev.publishedAt, intelligenceItems: [], criticalAlerts: [], earthquakes: [], countryRisks: [], savedDataSummary: { intelligenceCount: 0, alertsCount: 0, countriesCount: 0 }, apiHealth: { gnews: "live", usgs: "live", supabase: "na", openWeather: "na", map: "na" } },
        }),
      });
      const data = (await res.json()) as { answer?: string; fallbackAnswer?: string };
      const answer = data.answer ?? data.fallbackAnswer ?? "";
      if (answer) {
        setSelectedEvent({ ...ev, aiSummary: answer });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.aiAnalysisFailedShort"));
    } finally {
      setAiLoading(false);
    }
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  const refreshDisabled = loading || cooldownLeft > 0;

  return (
    <div className="page-shell space-y-6">
      <PageHero
        title={t("app.pages.intelligence.title")}
        subtitle={t("app.pages.intelligence.subtitle")}
        icon={<Cpu className="h-5 w-5" />}
        badges={
          <>
            <DataBadge variant={statusVariant(newsStatus)}>
              {statusLabel(newsStatus, t, statusMsg)} · {t("app.pages.intelligence.articles", { count: processed?.totalArticles ?? 0 })}
            </DataBadge>
            {newsSource && <DataBadge variant="source">{newsSource}</DataBadge>}
            {processed && (
              <>
                <DataBadge variant="neutral">{t("app.pages.intelligence.events", { count: processed.events.length })}</DataBadge>
                {processed.totalClustered > 0 && (
                  <DataBadge variant="neutral">{t("app.pages.intelligence.clustered", { count: processed.totalClustered })}</DataBadge>
                )}
                <DataBadge variant="neutral">
                  {t("app.ui.updated")} <span suppressHydrationWarning>{updated.toLocaleTimeString()}</span>
                </DataBadge>
              </>
            )}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshDisabled}
              title={cooldownLeft > 0 ? t("app.ui.waitSeconds", { seconds: cooldownLeft }) : t("app.pages.intelligence.refreshFeed")}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-4 py-2 text-sm text-foreground disabled:opacity-50 hover:bg-secondary/40 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {cooldownLeft > 0 ? t("app.ui.waitSeconds", { seconds: cooldownLeft }) : t("app.pages.intelligence.refresh")}
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => {
                  invalidateIntelligenceStore();
                  toast.success(t("app.toasts.cacheCleared"));
                  void load({ force: true });
                }}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {t("app.pages.intelligence.clearCache")}
              </button>
            )}
          </>
        }
      />

      {statusMsg && newsStatus !== "live" && newsStatus !== "cached" ? (
        <ErrorMessage message={statusMsg} />
      ) : null}

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          { labelKey: "critical" as const, value: counts.critical, color: "text-rose-glow", icon: ShieldAlert },
          { labelKey: "high" as const, value: counts.high, color: "text-amber-glow", icon: TrendingUp },
          { labelKey: "medium" as const, value: counts.medium, color: "text-cyan-glow", icon: Activity },
          { labelKey: "low" as const, value: counts.low, color: "text-emerald-glow", icon: Radio },
        ]).map(({ labelKey, value, color, icon: Icon }) => (
          <div key={labelKey} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(`app.ui.severity.${labelKey}`)}</span>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </div>
            <div className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter panel ── */}
      <IntelligenceEngineFilters
        filter={filter}
        onChange={setFilter}
        availableCountries={availableCountries}
        availableSources={availableSources}
      />

      {/* ── Sort + view controls ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-secondary/10 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.intelligence.sort")}</span>
          {([
            ["importance", t("app.pages.intelligence.sortImportance")],
            ["newest", t("app.pages.intelligence.sortNewest")],
            ["severity", t("app.pages.intelligence.sortSeverity")],
            ["confidence", t("app.pages.intelligence.sortConfidence")],
            ["country", t("app.pages.intelligence.sortCountry")],
            ["source", t("app.pages.intelligence.sortSource")],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setSortMode(value as SortMode)}
              className={`rounded-md border px-2.5 py-1 text-[11px] ${sortMode === value ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.intelligence.view")}</span>
          <button type="button" onClick={() => setViewMode("timeline")}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] ${viewMode === "timeline" ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>
            <Activity className="h-3.5 w-3.5" /> {t("app.pages.intelligence.viewTimeline")}
          </button>
          <button type="button" onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] ${viewMode === "grid" ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> {t("app.pages.intelligence.viewGrid")}
          </button>
          {viewMode === "grid" && (
            <>
              <Button variant={layout === "compact" ? "secondary" : "outline"} size="sm"
                className="h-8 gap-1 text-xs" onClick={() => setLayout("compact")}>
                <LayoutGrid className="h-3.5 w-3.5" /> {t("app.pages.intelligence.viewCompact")}
              </Button>
              <Button variant={layout === "detailed" ? "secondary" : "outline"} size="sm"
                className="h-8 gap-1 text-xs" onClick={() => setLayout("detailed")}>
                <List className="h-3.5 w-3.5" /> {t("app.pages.intelligence.viewDetailed")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Events column ── */}
        <div className="space-y-4 lg:col-span-2">
          <SectionHeader
            title={t("app.pages.intelligence.eventsTitle")}
            subtitle={
              processed
                ? t("app.pages.intelligence.processedSubtitle", { count: filteredEvents.length })
                : t("app.pages.intelligence.processing")
            }
          />

          {/* Loading skeleton */}
          {loading && !processed ? (
            <LoadingSpinner label={t("app.pages.intelligence.loading")} />
          ) : null}
          {loading && processed ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-lg border border-border/40 bg-secondary/30" />
              ))}
            </div>
          ) : null}

          {/* Empty state */}
          {!loading && processed && filteredEvents.length === 0 ? (
            <EmptyState title={t("app.pages.intelligence.emptyTitle")} hint={t("app.pages.intelligence.emptyHint")} />
          ) : null}

          {/* Events */}
          {!loading && processed && filteredEvents.length > 0 ? (
            viewMode === "timeline" ? (
              <IntelligenceTimeline
                events={displayedEvents}
                layout={layout}
                onOpen={setSelectedEvent}
                onSave={handleSave}
                onLocate={handleLocate}
                onAI={handleAI}
                onRelated={setSelectedEvent}
              />
            ) : (
              <div className={`grid gap-3 ${layout === "detailed" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                {displayedEvents.map((ev) => (
                  <IntelligenceEventCard
                    key={ev.id}
                    event={ev}
                    layout={layout}
                    onOpen={setSelectedEvent}
                    onSave={handleSave}
                    onLocate={handleLocate}
                    onAI={handleAI}
                    onRelated={setSelectedEvent}
                  />
                ))}
              </div>
            )
          ) : null}

          {/* Load more */}
          {processed && sortedEvents.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisibleCount((v) => v + LOAD_MORE_STEP)}>
                {t("app.pages.intelligence.loadMore", { remaining: sortedEvents.length - visibleCount })}
              </Button>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-5">
          {/* Global Risk Index */}
          {processed && (
            <div>
              <SectionHeader title={t("app.pages.intelligence.globalRiskTitle")} subtitle={t("app.pages.intelligence.globalRiskSubtitle")} right={<Brain className="h-4 w-4 text-primary" />} />
              <GlobalRiskIndex data={processed.globalRisk} />
            </div>
          )}

          {/* Country Risk Engine */}
          <div>
            <SectionHeader
              title={t("app.pages.intelligence.countryRiskTitle")}
              subtitle={t("app.pages.intelligence.countryRiskSubtitle", { count: Math.min(processed?.countryRisks.length ?? 0, 20) })}
              right={<ShieldAlert className="h-4 w-4 text-amber-glow" />}
            />
            {processed ? (
              <CountryRiskPanel risks={processed.countryRisks} initialLimit={10} />
            ) : (
              <EmptyState title={t("app.pages.intelligence.riskLoadingTitle")} hint={t("app.pages.intelligence.riskLoadingHint")} />
            )}
          </div>

          {/* Engine info */}
          {processed && (
            <div className="glass-card p-3 text-[11px] text-muted-foreground">
              <div className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="h-3.5 w-3.5" /> Intelligence Engine
              </div>
              <div className="space-y-0.5">
                <div>{processed.totalArticles} raw articles → {processed.events.length} events</div>
                {processed.totalClustered > 0 && <div>{processed.totalClustered} duplicates clustered</div>}
                <div>Entity extraction · NLP scoring · Risk model</div>
                <div suppressHydrationWarning>Processed {new Date(processed.processedAt).toLocaleTimeString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Details Drawer ── */}
      <EventDetailsDrawer
        event={selectedEvent}
        relatedEvents={relatedEvents}
        aiLoading={aiLoading}
        onClose={() => setSelectedEvent(null)}
        onSave={handleSave}
        onLocate={handleLocate}
        onAI={handleAI}
        onSelectRelated={setSelectedEvent}
      />
    </div>
  );
}
