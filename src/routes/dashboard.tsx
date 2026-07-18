/**
 * Dashboard — Global Operations Center.
 *
 * Architecture: Single data fetch (getDashboardSnapshot, 60s cache).
 * All panels receive data as props — zero duplicate API calls.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  COMMAND HEADER  (Global Status Banner — full width)                 │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  METRIC STRIP  (5 live counters)                                     │
 * ├──────────────────────────────┬───────────────────────────────────────┤
 * │  LIVE VIDEO HERO  (xl: 8)    │  BREAKING INTELLIGENCE (xl: 4)        │
 * │  Sky News / auto-load        │  Priority-ranked event feed           │
 * ├─────────────┬────────────────┴────────────┬──────────────────────────┤
 * │  STABILITY  │  AI EXECUTIVE SUMMARY (xl:5)│  ACTIVE THREATS (xl:4)  │
 * │  (xl:3)     │                             │                          │
 * ├─────────────┴──────────────────┬──────────┴─────────┬───────────────┤
 * │  WORLD ACTIVITY TIMELINE (7)   │  MAP PREVIEW  (3)  │  QUAKE (2)    │
 * ├────────────────────────────────┴────────────────────┴───────────────┤
 * │  ADVANCED: Sectors · Trending · Charts · Live Feed · API Health     │
 * └──────────────────────────────────────────────────────────────────────┘
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import en from "@/locales/en.json";
import { useT } from "@/i18n";
import {
  Globe2, Activity, Flag, Bookmark, AlertTriangle, ArrowRight,
  Newspaper, Sparkles, FileText, BookMarked, BarChart2,
  GitCompareArrows, Brain, Zap, Shield,
} from "lucide-react";

/* ── UI Components ───────────────────────────────────────────────────── */
import { StatCard } from "@/components/ui/StatCard";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/* ── Dashboard Panels ────────────────────────────────────────────────── */
import { DashboardStatusBar } from "@/components/dashboard/StatusBar";
import { CommandVideoPlayer } from "@/components/dashboard/CommandVideoPlayer";
import { BreakingIntelligencePanel } from "@/components/dashboard/BreakingIntelligencePanel";
import { GlobalStabilityPanel } from "@/components/dashboard/GlobalStabilityPanel";
import { AIExecutiveSummaryWidget } from "@/components/dashboard/AIExecutiveSummaryWidget";
import { ActiveThreatsPanel } from "@/components/dashboard/ActiveThreatsPanel";
import { WorldActivityTimeline } from "@/components/dashboard/WorldActivityTimeline";
import { MapPreview } from "@/components/dashboard/MapPreview";
import { EarthquakeWidget } from "@/components/dashboard/EarthquakeWidget";
import { IntelligenceSectorsPanel } from "@/components/dashboard/IntelligenceSectorsPanel";
import { TrendingTopicsPanel } from "@/components/dashboard/TrendingTopicsPanel";
import { CriticalSignalsPanel } from "@/components/dashboard/CriticalSignalsPanel";
import { CategoryDistributionChart } from "@/components/dashboard/CategoryDistributionChart";
import { ApiHealthPanel } from "@/components/dashboard/ApiHealthPanel";
import { LiveIntelligencePanel } from "@/components/dashboard/LiveIntelligencePanel";
import { EarthquakeMagnitudeChart } from "@/components/charts/EarthquakeMagnitudeChart";
import { RiskScoreCard } from "@/components/intelligence/RiskScoreCard";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";

/* ── Data / Context ──────────────────────────────────────────────────── */
import {
  getDashboardSnapshot,
  invalidateDashboardCache,
  type DashboardSnapshot,
} from "@/services/dashboardService";
import { useViewMode } from "@/context/ViewModeContext";
import type { IntelligenceItem } from "@/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: en.app.pages.dashboard.metaTitle },
      { name: "description", content: en.app.pages.dashboard.metaDescription },
    ],
  }),
  component: DashboardPage,
});

/* ── Constants ───────────────────────────────────────────────────────── */

const REFRESH_COOLDOWN_MS = 60_000;

/* ── Quick-nav links ─────────────────────────────────────────────────── */

const QUICK_LINKS = [
  { to: "/map",          labelKey: "app.pages.dashboard.quickLinks.globe",    icon: Globe2,            accent: "text-cyan-glow" },
  { to: "/ai-news",      labelKey: "app.pages.dashboard.quickLinks.ai",       icon: Brain,             accent: "text-primary" },
  { to: "/reports",      labelKey: "app.pages.dashboard.quickLinks.reports",  icon: FileText,          accent: "text-emerald-glow" },
  { to: "/analytics",    labelKey: "app.pages.dashboard.quickLinks.analytics",icon: BarChart2,         accent: "text-amber-glow" },
  { to: "/compare",      labelKey: "app.pages.dashboard.quickLinks.compare",  icon: GitCompareArrows,  accent: "text-muted-foreground" },
  { to: "/intelligence", labelKey: "app.pages.dashboard.quickLinks.intel",    icon: Newspaper,         accent: "text-muted-foreground" },
  { to: "/watchlist",    labelKey: "app.pages.dashboard.quickLinks.watchlist",icon: BookMarked,        accent: "text-muted-foreground" },
  { to: "/alert-center", labelKey: "app.pages.dashboard.quickLinks.alerts",   icon: AlertTriangle,     accent: "text-rose-glow" },
] as const;

const PLATFORM_NAV_LINKS = [
  { to: "/ai-news",      labelKey: "app.pages.dashboard.platformNav.ai.label",         hintKey: "app.pages.dashboard.platformNav.ai.hint",         icon: Sparkles },
  { to: "/reports",      labelKey: "app.pages.dashboard.platformNav.reports.label",    hintKey: "app.pages.dashboard.platformNav.reports.hint",    icon: FileText },
  { to: "/intelligence", labelKey: "app.pages.dashboard.platformNav.feed.label",         hintKey: "app.pages.dashboard.platformNav.feed.hint",         icon: Newspaper },
  { to: "/map",          labelKey: "app.pages.dashboard.platformNav.map.label",          hintKey: "app.pages.dashboard.platformNav.map.hint",          icon: Globe2 },
  { to: "/countries",    labelKey: "app.pages.dashboard.platformNav.countries.label",    hintKey: "app.pages.dashboard.platformNav.countries.hint",    icon: Flag },
  { to: "/earthquakes",  labelKey: "app.pages.dashboard.platformNav.earthquakes.label",  hintKey: "app.pages.dashboard.platformNav.earthquakes.hint",  icon: Activity },
  { to: "/alert-center", labelKey: "app.pages.dashboard.platformNav.alerts.label",       hintKey: "app.pages.dashboard.platformNav.alerts.hint",       icon: AlertTriangle },
  { to: "/watchlist",    labelKey: "app.pages.dashboard.platformNav.watchlist.label",    hintKey: "app.pages.dashboard.platformNav.watchlist.hint",    icon: BookMarked },
  { to: "/analytics",    labelKey: "app.pages.dashboard.platformNav.analytics.label",    hintKey: "app.pages.dashboard.platformNav.analytics.hint",    icon: BarChart2 },
  { to: "/compare",      labelKey: "app.pages.dashboard.platformNav.compare.label",      hintKey: "app.pages.dashboard.platformNav.compare.hint",      icon: GitCompareArrows },
  { to: "/saved",        labelKey: "app.pages.dashboard.platformNav.saved.label",        hintKey: "app.pages.dashboard.platformNav.saved.hint",        icon: Bookmark },
  { to: "/ai-news",      labelKey: "app.pages.dashboard.platformNav.askAi.label",        hintKey: "app.pages.dashboard.platformNav.askAi.hint",        icon: Brain },
] as const;

type StabilityTier = "stable" | "elevated" | "highAlert" | "critical";

/* ── Stability computation ────────────────────────────────────────────── */

function computeStability(
  intel: IntelligenceItem[],
  quakeCount: number,
): { score: number; tier: StabilityTier } {
  const critical = intel.filter((i) => i.severity === "critical").length;
  const high = intel.filter((i) => i.severity === "high").length;
  const threatScore = Math.min(100, critical * 4 + high * 2 + Math.floor(quakeCount / 5));
  const score = Math.max(0, 100 - threatScore);
  const tier: StabilityTier =
    score >= 75 ? "stable" :
    score >= 50 ? "elevated" :
    score >= 25 ? "highAlert" :
    "critical";
  return { score, tier };
}

/* ── Page ────────────────────────────────────────────────────────────── */

function DashboardPage() {
  const t = useT();
  const { isSimple } = useViewMode();
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date>(new Date());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [activeModal, setActiveModal] = useState<IntelligenceItem | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  async function load(force = false) {
    setLoading(true);
    try {
      if (force) invalidateDashboardCache();
      const s = await getDashboardSnapshot(force);
      setSnap(s);
      setUpdated(new Date());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.errors.dashboardRefreshFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    document.title = t("app.pages.dashboard.metaTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("app.pages.dashboard.metaDescription"));
  }, [t]);

  function onRefresh() {
    if (loading) return;
    if (now < cooldownUntil) { toast.message(t("app.ui.pleaseWaitRefresh")); return; }
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    void load(true);
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1_000));

  /* ── Derived data ──────────────────────────────────────────────────── */

  // Memoized so the `?? []` fallback doesn't create a new array reference on
  // every render — keeps downstream useMemo/useCallback deps stable.
  const quakes = useMemo(() => snap?.quakes ?? [], [snap]);
  const intel  = useMemo(() => snap?.intel ?? [], [snap]);
  const saved  = useMemo(() => snap?.savedAlerts ?? [], [snap]);
  const risks  = useMemo(() => snap?.risks ?? [], [snap]);

  const today  = quakes.length;
  const maxMag = quakes.length ? Math.max(...quakes.map((q) => q.magnitude)) : 0;

  const intelCounts = useMemo(
    () =>
      intel.reduce(
        (r, i) => { r[i.severity] = (r[i.severity] ?? 0) + 1; return r; },
        { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>,
      ),
    [intel],
  );

  const stability = useMemo(
    () => computeStability(intel, today),
    [intel, today],
  );

  /* ── Save handler (shared) ─────────────────────────────────────────── */

  async function onSaveItem(item: IntelligenceItem) {
    const { isSupabaseConfigured, supabaseService } = await import(
      "@/services/supabaseService"
    );
    if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
    try {
      await supabaseService.saveIntelligence(item);
      toast.success(t("app.toasts.eventSaved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    }
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="page-shell space-y-4" role="main" aria-label={t("app.pages.dashboard.ariaMain")}>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  COMMAND HEADER                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <DashboardStatusBar
        status={snap?.newsStatus ?? "demo"}
        updated={updated}
        loading={loading}
        cooldownLeft={cooldownLeft}
        onRefresh={onRefresh}
        stabilityScore={snap ? stability.score : undefined}
        stabilityTier={snap ? stability.tier : undefined}
        criticalCount={intelCounts.critical}
        newsCount={intel.length}
        quakeCount={today}
        aiAvailable={false}
      />

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  METRIC STRIP + QUICK ACTIONS                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Live metric chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { labelKey: "app.pages.dashboard.metrics.stability",   value: snap ? `${stability.score}%` : "—", icon: Shield,      color: "text-emerald-glow" },
            { labelKey: "app.pages.dashboard.metrics.critical",    value: intelCounts.critical,                icon: AlertTriangle, color: "text-rose-glow" },
            { labelKey: "app.pages.dashboard.metrics.intel",       value: intel.length,                        icon: Newspaper,   color: "text-primary" },
            { labelKey: "app.pages.dashboard.metrics.earthquakes", value: today,                               icon: Activity,    color: "text-amber-glow" },
            { labelKey: "app.pages.dashboard.metrics.maxMag",      value: snap ? `M${maxMag.toFixed(1)}` : "—", icon: Activity, color: snap && maxMag >= 6 ? "text-rose-glow" : "text-muted-foreground" },
          ].map(({ labelKey, value, icon: Icon, color }) => {
            const label = t(labelKey);
            return (
            <div
              key={labelKey}
              className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-secondary/15 px-2.5 py-1.5"
              aria-label={`${label}: ${value}`}
            >
              <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} aria-hidden="true" />
              <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            );
          })}
        </div>

        {/* Quick nav */}
        <nav
          aria-label={t("app.pages.dashboard.sections.quickNavSimple")}
          className="flex flex-wrap gap-1.5"
        >
          {QUICK_LINKS.map((q) => {
            const Icon = q.icon;
            const label = t(q.labelKey);
            return (
              <Link
                key={q.to}
                to={q.to}
                className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-secondary/15 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={label}
              >
                <Icon className={`h-3 w-3 ${q.accent}`} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          {snap && (
            <DataBadge
              variant={
                snap.newsStatus === "live" ? "live" :
                snap.newsStatus === "cached" ? "neutral" :
                "demo"
              }
            >
              {snap.newsStatus.toUpperCase()}
            </DataBadge>
          )}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  HERO ROW: Live Video + Breaking Intelligence                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section
        className="dashboard-section xl:grid-cols-12"
        aria-label={t("app.pages.dashboard.sections.liveVideoBreaking")}
      >
        <div className="grid-cell xl:col-span-8">
          <CommandVideoPlayer defaultId="skynews" />
        </div>
        <div className="grid-cell xl:col-span-4">
          <BreakingIntelligencePanel
            items={snap ? intel : null}
            loading={loading}
            maxItems={14}
            onSave={onSaveItem}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  OPERATIONAL ROW: Stability · AI Summary · Active Threats     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section
        className="dashboard-section xl:grid-cols-12"
        aria-label={t("app.pages.dashboard.sections.operationalPanels")}
      >
        <div className="grid-cell xl:col-span-3">
          <GlobalStabilityPanel intel={intel} quakes={quakes} loading={loading} />
        </div>
        <div className="grid-cell xl:col-span-5">
          <AIExecutiveSummaryWidget intel={intel} quakes={quakes} risks={risks} />
        </div>
        <div className="grid-cell xl:col-span-4">
          <ActiveThreatsPanel intel={intel} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  ANALYSIS ROW: Timeline · Map · Earthquake Widget            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section
        className="dashboard-section xl:grid-cols-12"
        aria-label={t("app.pages.dashboard.sections.worldActivity")}
      >
        <div className="grid-cell xl:col-span-7">
          <WorldActivityTimeline intel={intel} quakes={quakes} saved={saved} />
        </div>
        <div className="grid-cell flex flex-col gap-4 xl:col-span-5">
          <MapPreview
            earthquakeCount={today}
            intelCount={intel.length}
            alertCount={saved.length}
          />
          <EarthquakeWidget quakes={quakes} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  ADVANCED SECTIONS (hidden in Simple mode)                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {!isSimple && (
        <>
          {/* Intelligence Sectors + Trending Topics */}
          <section
            className="dashboard-section lg:grid-cols-3"
            aria-label={t("app.pages.dashboard.sections.sectorTrends")}
          >
            <div className="grid-cell lg:col-span-2">
              <IntelligenceSectorsPanel
                intel={intel}
                quakes={quakes}
                onOpenEvent={setActiveModal}
              />
            </div>
            <TrendingTopicsPanel intel={intel} />
          </section>

          <section
            className="dashboard-section lg:grid-cols-2"
            aria-label={t("app.pages.dashboard.sections.criticalRisk")}
          >
            <CriticalSignalsPanel intel={intel} quakes={quakes} saved={saved} />

            <div className="grid-cell glass-card p-4">
              <SectionHeader
                title={t("app.pages.dashboard.countryRiskIndex.title")}
                subtitle={t("app.pages.dashboard.countryRiskIndex.subtitle")}
                right={<DataBadge variant="neutral">0–100</DataBadge>}
                size="sm"
              />
              {!snap ? (
                <LoadingSpinner variant="center" size="sm" label={t("app.pages.dashboard.countryRiskIndex.loading")} />
              ) : risks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{t("app.pages.dashboard.countryRiskIndex.empty")}</p>
              ) : (
                <div className="panel-scroll space-y-2">
                  {risks.slice(0, 10).map((r, idx) => (
                    <RiskScoreCard key={r.country} rank={idx + 1} risk={r} />
                  ))}
                </div>
              )}
              <Link
                to="/intelligence"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {t("app.pages.dashboard.countryRiskIndex.fullIndex")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* Analytics charts */}
          <section
            className="dashboard-section lg:grid-cols-3"
            aria-label={t("app.pages.dashboard.sections.analyticsCharts")}
          >
            <div className="grid-cell glass-card p-4 lg:col-span-2">
              <SectionHeader
                title={t("app.pages.dashboard.earthquakeChart.title")}
                subtitle={t("app.pages.dashboard.earthquakeChart.subtitle")}
                right={<DataBadge variant="source">USGS</DataBadge>}
                size="sm"
              />
              {snap ? (
                <EarthquakeMagnitudeChart data={quakes} />
              ) : (
                <div className="skeleton h-56 rounded-lg" />
              )}
            </div>
            <CategoryDistributionChart items={intel} />
          </section>

          {/* Full intelligence feed */}
          <section aria-label={t("app.pages.dashboard.sections.fullFeed")}>
            <LiveIntelligencePanel
              items={snap ? intel : null}
              status={snap?.newsStatus ?? "demo"}
              loading={loading}
              cooldownLeft={cooldownLeft}
              onRefresh={onRefresh}
            />
          </section>

          {/* System & Platform */}
          <section
            id="api-health"
            className="dashboard-section lg:grid-cols-2"
            aria-label={t("app.pages.dashboard.sections.systemHealth")}
          >
            <ApiHealthPanel />

            <div className="grid-cell glass-card p-4">
              <SectionHeader
                title={t("app.pages.dashboard.platformNav.title")}
                subtitle={t("app.pages.dashboard.platformNav.subtitle")}
                size="sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {PLATFORM_NAV_LINKS.map((q) => {
                  const I = q.icon;
                  return (
                    <Link
                      key={`${q.to}-${q.labelKey}`}
                      to={q.to}
                      className="group flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/10 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <I
                        className="h-4 w-4 flex-shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{t(q.labelKey)}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{t(q.hintKey)}</div>
                      </div>
                      <ArrowRight
                        className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          {/* KPI Stat Cards (advanced mode) */}
          <section aria-label={t("app.pages.dashboard.sections.platformStats")}>
            <div className="grid grid-cols-2 gap-3 min-w-0 sm:grid-cols-3 xl:grid-cols-6">
              <Link to="/intelligence" className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.intelEvents")}       value={intel.length}                                                  hint={snap?.newsStatus ?? "—"}        icon={<Newspaper className="h-4 w-4" />}     accent="cyan"    animatedValue={intel.length} />
              </Link>
              <Link to="/earthquakes" className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.earthquakes")}        value={snap ? today : "—"}                                            hint={t("app.pages.dashboard.stats.usgs24h")}                     icon={<Activity className="h-4 w-4" />}      accent="amber"   animatedValue={snap ? today : undefined} />
              </Link>
              <Link to="/earthquakes" className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.highestMagnitude")}  value={snap ? `M${maxMag.toFixed(1)}` : "—"}                         hint={t("app.pages.dashboard.stats.usgsFeed")}                      icon={<Activity className="h-4 w-4" />}      accent="rose"    />
              </Link>
              <Link to="/alert-center" className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.criticalHigh")}    value={snap ? intelCounts.critical + intelCounts.high : "—"}         hint={t("app.pages.dashboard.stats.activeThreats")}                 icon={<AlertTriangle className="h-4 w-4" />} accent="rose"    animatedValue={snap ? intelCounts.critical + intelCounts.high : undefined} />
              </Link>
              <Link to="/countries" search={{ q: undefined }} className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.countries")}          value={snap?.countryCount ?? "—"}                                    hint={t("app.pages.dashboard.stats.restCountries")}                 icon={<Flag className="h-4 w-4" />}          accent="emerald" animatedValue={snap?.countryCount ?? undefined} />
              </Link>
              <Link to="/watchlist" className="grid-cell block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <StatCard label={t("app.pages.dashboard.stats.savedAlerts")}       value={saved.length}                                                  hint={t("app.pages.dashboard.stats.watchCenter")}                   icon={<Zap className="h-4 w-4" />}           accent="amber"   animatedValue={saved.length} />
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Simple mode — compact nav links */}
      {isSimple && (
        <section aria-label={t("app.pages.dashboard.sections.quickNavSimple")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/ai-news",      labelKey: "app.pages.dashboard.simpleMode.askAi",         icon: Sparkles,  accent: "text-primary" },
            { to: "/reports",      labelKey: "app.pages.dashboard.simpleMode.generateReport", icon: FileText,  accent: "text-emerald-glow" },
            { to: "/map",          labelKey: "app.pages.dashboard.simpleMode.liveMap",        icon: Globe2,    accent: "text-cyan-glow" },
            { to: "/intelligence", labelKey: "app.pages.dashboard.simpleMode.intelFeed",      icon: Newspaper, accent: "text-amber-glow" },
          ].map((q) => {
            const I = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                className="glass-card group flex items-center justify-between p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <I className={`h-4 w-4 ${q.accent}`} aria-hidden="true" />
                  <span className="text-sm font-medium">{t(q.labelKey)}</span>
                </div>
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </section>
      )}

      {/* ── Shared modal ─────────────────────────────────────────────── */}
      <IntelligenceDetailsModal
        item={activeModal}
        onClose={() => setActiveModal(null)}
        onSave={onSaveItem}
      />
    </div>
  );
}
