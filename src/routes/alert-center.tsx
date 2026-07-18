/**
 * Global Alert Center — dedicated operational page for the Global Alert &
 * Crisis Management System. Displays active/resolved/critical/regional/
 * country alerts, the alert timeline, crisis briefings, statistics, and
 * the user's watchlist.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Globe2, MapPin,
  BarChart3, RefreshCw, Loader2, Radio,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAlertCenter } from "@/alert-system/hooks/useAlertCenter";
import {
  filterActiveAlerts, filterCriticalAlerts, filterResolvedAlerts, getAlertHistory, getEventsForAlert, getAllCrisisBriefings,
} from "@/alert-system/services/alertCenterService";
import { AlertCard } from "@/alert-system/components/AlertCard";
import { AlertDetailPanel } from "@/alert-system/components/AlertDetailPanel";
import { CrisisCard } from "@/alert-system/components/CrisisCard";
import { WatchlistPanel } from "@/alert-system/components/WatchlistPanel";
import type { GlobalAlert, HistoryWindow } from "@/alert-system/types";
import { ALERT_LEVEL_COLORS } from "@/alert-system/types";
import { useT } from "@/i18n";

export const Route = createFileRoute("/alert-center")({
  head: () => ({ meta: [{ title: "Global Alert Center — Global Pulse" }] }),
  component: AlertCenterPage,
});

type TabId = "active" | "critical" | "resolved" | "regional" | "country" | "timeline";

const TABS: { id: TabId; labelKey: string; icon: typeof AlertTriangle }[] = [
  { id: "active",   labelKey: "app.pages.alertCenter.tabs.active",    icon: Radio },
  { id: "critical", labelKey: "app.pages.alertCenter.tabs.critical",  icon: ShieldAlert },
  { id: "resolved", labelKey: "app.pages.alertCenter.tabs.resolved",  icon: CheckCircle2 },
  { id: "regional", labelKey: "app.pages.alertCenter.tabs.regional",  icon: Globe2 },
  { id: "country",  labelKey: "app.pages.alertCenter.tabs.country",   icon: MapPin },
  { id: "timeline", labelKey: "app.pages.alertCenter.tabs.timeline",  icon: BarChart3 },
];

function StatChip({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-center min-w-[80px]">
      <div className="text-lg font-semibold tabular-nums" style={{ color: color ?? undefined }}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function AlertCenterPage() {
  const t = useT();
  const { bundle, loading, error, refresh } = useAlertCenter();
  const [activeTab, setActiveTab] = useState<TabId>("active");
  const [selectedAlert, setSelectedAlert] = useState<GlobalAlert | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>("24h");

  const briefings = useMemo(() => (bundle ? getAllCrisisBriefings(bundle) : []), [bundle]);

  const listForTab: GlobalAlert[] = useMemo(() => {
    if (!bundle) return [];
    switch (activeTab) {
      case "active":   return filterActiveAlerts(bundle);
      case "critical": return filterCriticalAlerts(bundle);
      case "resolved": return filterResolvedAlerts(bundle);
      case "regional":
        return regionFilter
          ? bundle.alerts.filter((a) => a.affectedRegions.includes(regionFilter))
          : bundle.alerts;
      case "country":
        return countryFilter
          ? bundle.alerts.filter((a) => a.affectedCountries.some((c) => c.toLowerCase() === countryFilter.toLowerCase()))
          : bundle.alerts;
      case "timeline":  return getAlertHistory(historyWindow);
      default: return bundle.alerts;
    }
  }, [bundle, activeTab, regionFilter, countryFilter, historyWindow]);

  if (loading && !bundle) {
    return (
      <div className="flex items-center justify-center py-24" role="main" aria-label="Global Alert Center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="py-16" role="main" aria-label="Global Alert Center">
        <EmptyState title={t("app.pages.alertCenter.loadError")} hint={error} icon={<AlertTriangle className="w-6 h-6" />} />
      </div>
    );
  }

  const analytics = bundle?.analytics;
  const events = selectedAlert && bundle ? getEventsForAlert(bundle, selectedAlert) : [];

  return (
    <div className="page-shell space-y-5" role="main" aria-label="Global Alert Center">
      <PageHero
        title={t("app.pages.alertCenter.title")}
        subtitle={t("app.pages.alertCenter.subtitle")}
        icon={<ShieldAlert className="h-5 w-5" />}
        actions={
          <button
            onClick={() => void refresh(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/40 text-foreground transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t("app.ui.refresh")}
          </button>
        }
      />

      {/* Stats bar */}
      {analytics && (
        <div className="flex flex-wrap gap-2">
          <StatChip label="Active" value={analytics.totalActive} color="#3b82f6" />
          <StatChip label="Critical" value={analytics.totalCritical} color={ALERT_LEVEL_COLORS.critical} />
          <StatChip label="Extreme" value={analytics.totalExtreme} color={ALERT_LEVEL_COLORS.extreme} />
          <StatChip label="Resolved" value={analytics.totalResolved} color="#6b7280" />
          <StatChip label="Avg Confidence" value={`${analytics.avgConfidence}%`} color="#22c55e" />
          <StatChip label="Multi-Source" value={`${Math.round(analytics.multiSourceRate * 100)}%`} color="#a855f7" />
          <StatChip label="Active Crises" value={bundle?.crises.length ?? 0} color="#f97316" />
        </div>
      )}

      {/* Active crises + briefings */}
      {bundle && bundle.crises.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" /> Detected Crisis Situations
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {bundle.crises.map((crisis) => (
              <CrisisCard key={crisis.id} crisis={crisis} briefing={briefings.find((b) => b.crisisId === crisis.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Main column */}
        <div className="space-y-3 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
            {TABS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Region/country/history sub-filters */}
          {activeTab === "regional" && bundle && (
            <div className="flex gap-1.5 flex-wrap">
              {[...new Set(bundle.alerts.flatMap((a) => a.affectedRegions))].map((r) => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(regionFilter === r ? null : r)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    regionFilter === r ? "border-primary/40 bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {activeTab === "country" && bundle && (
            <div className="flex gap-1.5 flex-wrap">
              {analytics?.topCountries.slice(0, 12).map(({ country }) => (
                <button
                  key={country}
                  onClick={() => setCountryFilter(countryFilter === country ? null : country)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    countryFilter === country ? "border-primary/40 bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {country}
                </button>
              ))}
            </div>
          )}
          {activeTab === "timeline" && (
            <div className="flex gap-1.5">
              {(["24h", "7d", "30d", "all"] as HistoryWindow[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setHistoryWindow(w)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    historyWindow === w ? "border-primary/40 bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w === "24h" ? "Last 24h" : w === "7d" ? "Last 7 days" : w === "30d" ? "Last 30 days" : "All time"}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
            {listForTab.length === 0 ? (
              <EmptyState
                title={t("app.pages.alertCenter.emptyTitle")}
                hint={t("app.pages.alertCenter.emptyHint")}
                icon={<AlertTriangle className="w-6 h-6" />}
              />
            ) : (
              listForTab.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  selected={selectedAlert?.id === alert.id}
                  onClick={() => setSelectedAlert(alert)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column: detail panel or watchlist */}
        <div className="space-y-4">
          {selectedAlert ? (
            <div className="h-[70vh]">
              <AlertDetailPanel alert={selectedAlert} events={events} onClose={() => setSelectedAlert(null)} />
            </div>
          ) : (
            <WatchlistPanel />
          )}
        </div>
      </div>
    </div>
  );
}
