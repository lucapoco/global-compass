/**
 * DashboardStatusBar — Global Operations Center header banner.
 *
 * Immediately communicates the platform's live status:
 *  - Intelligence feed health (LIVE / CACHED / DEMO / ERROR)
 *  - Global stability score and tier
 *  - Critical count, news count, earthquake count, AI availability
 *  - Last refresh timestamp
 *  - Refresh action + quick navigation
 */
import { RefreshCw, Shield, AlertTriangle, Newspaper, Activity, Brain, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/i18n";
import { DataBadge } from "@/components/ui/DataBadge";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand";
import type { NewsStatus } from "@/services/newsApi";

/* ── Props ───────────────────────────────────────────────────────────────── */

interface Props {
  status: NewsStatus;
  updated: Date;
  loading?: boolean;
  cooldownLeft?: number;
  onRefresh: () => void;
  stabilityScore?: number;
  stabilityTier?: "stable" | "elevated" | "highAlert" | "critical";
  criticalCount?: number;
  newsCount?: number;
  quakeCount?: number;
  aiAvailable?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function statusVariant(s: NewsStatus): "live" | "neutral" | "demo" | "error" {
  if (s === "live") return "live";
  if (s === "cached") return "neutral";
  if (s === "rate_limited" || s === "error") return "error";
  return "demo";
}

function statusLabel(s: NewsStatus, t: (key: string) => string): string {
  const map: Partial<Record<NewsStatus, string>> = {
    live: t("app.ui.dataStatus.live"),
    cached: t("app.ui.dataStatus.cached"),
    demo: t("app.ui.dataStatus.demo"),
  };
  return map[s] ?? s.toUpperCase();
}

function tierColor(tier?: Props["stabilityTier"]): string {
  if (!tier) return "text-muted-foreground";
  if (tier === "critical") return "text-rose-400";
  if (tier === "highAlert") return "text-amber-400";
  if (tier === "elevated") return "text-yellow-400";
  return "text-emerald-400";
}

function scoreBarColor(score?: number): string {
  if (!score && score !== 0) return "bg-muted";
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-rose-500";
}

/* ── Metric chip ─────────────────────────────────────────────────────────── */

function MetricChip({
  icon: Icon, label, value, color = "text-muted-foreground",
}: {
  icon: React.ElementType; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 min-w-0">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} aria-hidden="true" />
      <div className="min-w-0">
        <div className={`text-sm font-bold tabular-nums leading-none ${color}`}>{value}</div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight mt-0.5">{label}</div>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function DashboardStatusBar({
  status, updated, loading = false, cooldownLeft = 0, onRefresh,
  stabilityScore, stabilityTier, criticalCount = 0,
  newsCount = 0, quakeCount = 0, aiAvailable = false,
}: Props) {
  const t = useT();
  const disabled = loading || cooldownLeft > 0;
  const tierLabel = stabilityTier ? t(`app.ui.stability.${stabilityTier}`) : undefined;

  return (
    <div className="glass-card relative overflow-hidden" role="banner" aria-label={t("app.pages.dashboard.statusBar.title")}>
      <div className="p-5 lg:p-6">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo variant="icon" theme="light" size={44} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DataBadge variant={statusVariant(status)}>{statusLabel(status, t)}</DataBadge>
                {aiAvailable && <DataBadge variant="neutral">{t("app.pages.dashboard.statusBar.assistantReady")}</DataBadge>}
              </div>
              <h1 className="text-heading-xl mt-1.5 truncate tracking-tight">{t("app.pages.dashboard.statusBar.title")}</h1>
              <p className="text-body-s text-muted-foreground mt-0.5 line-clamp-2">{t("app.pages.dashboard.statusBar.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <Button
              variant="outline" size="sm" onClick={onRefresh} disabled={disabled} loading={loading}
              title={cooldownLeft > 0 ? t("app.ui.waitSeconds", { seconds: cooldownLeft }) : t("app.pages.dashboard.statusBar.refreshTitle")}
              aria-label={
                loading ? t("app.pages.dashboard.statusBar.refreshAriaLoading") :
                cooldownLeft > 0 ? t("app.pages.dashboard.statusBar.refreshAriaCooldown", { seconds: cooldownLeft }) :
                t("app.pages.dashboard.statusBar.refreshAria")
              }
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {cooldownLeft > 0 ? `${cooldownLeft}s` : loading ? t("app.ui.loading") : t("app.ui.refresh")}
            </Button>
            <Link to="/map" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.dashboard.statusBar.liveMap")}
            </Link>
            <Link to="/ai-news" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/15">
              <Brain className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.dashboard.statusBar.askAi")}
            </Link>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex flex-wrap gap-2 mb-4">
          <MetricChip icon={Shield} label="Stability" value={stabilityScore !== undefined ? `${stabilityScore}%` : "—"} color={tierColor(stabilityTier)} />
          <MetricChip icon={AlertTriangle} label={t("app.ui.severity.critical")} value={criticalCount} color={criticalCount > 0 ? "text-rose-400" : "text-emerald-400"} />
          <MetricChip icon={Newspaper} label={t("app.pages.dashboard.statusBar.intelEvents")} value={newsCount} color="text-primary" />
          <MetricChip icon={Activity} label={t("app.nav.earthquakes")} value={quakeCount} color={quakeCount > 10 ? "text-amber-400" : "text-muted-foreground"} />
          <MetricChip icon={Brain} label={t("app.pages.dashboard.statusBar.aiStatus")} value={aiAvailable ? t("app.pages.dashboard.statusBar.aiOnline") : t("app.pages.dashboard.statusBar.aiLimited")} color={aiAvailable ? "text-emerald-400" : "text-muted-foreground"} />
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/50 px-3 py-2 ml-auto">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
            <div>
              <div suppressHydrationWarning className="text-xs text-muted-foreground leading-none">{updated.toLocaleTimeString()}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 leading-tight mt-0.5">{t("app.ui.updated")}</div>
            </div>
          </div>
        </div>

        {/* Stability bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-medium">
              {t("app.pages.dashboard.statusBar.globalStabilityIndex", { tier: tierLabel ?? t("app.pages.dashboard.statusBar.computing") })}
            </span>
            {stabilityScore !== undefined && (
              <span className={`font-bold ${tierColor(stabilityTier)}`}>{stabilityScore}%</span>
            )}
          </div>
          <div
            role="progressbar" aria-label={`Global stability: ${stabilityScore ?? 0}%`}
            aria-valuenow={stabilityScore ?? 0} aria-valuemin={0} aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(stabilityScore)}`}
              style={{ width: `${stabilityScore ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
