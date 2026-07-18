/**
 * Analytics — GP-012: Predictive Analytics / Trend Engine.
 *
 * Route: /analytics
 *
 * Architecture decisions:
 *  1. All computations are pure — trendAnalyzer.ts has no side effects.
 *  2. Data comes from the centralized Intelligence Store (90s shared cache).
 *  3. Trend comparison uses two time windows:
 *       • Recent:   last 0–6 hours
 *       • Baseline: 6–24 hours ago
 *  4. "Predictive" means: explaining observable change direction only.
 *     The platform never forecasts events — it surfaces patterns.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart2, RefreshCw, TrendingUp, Clock, Globe2, Shield,
  Cpu, TrendingDown, Minus, Activity,
} from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { TrendPanel, TrendBadge } from "@/components/intelligence/TrendIndicator";
import { analyzeTrends } from "@/services/analytics/trendAnalyzer";
import type { TrendDirection } from "@/services/analytics/trendAnalyzer";
// Centralized Intelligence Store — analytics now spans every active
// provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS,
// World Bank, ...), not just GNews + USGS.
import { getLatestEvents } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes } from "@/domain/adapters/legacyIntelAdapter";
import type { IntelligenceItem, Earthquake } from "@/types";
import { useT } from "@/i18n";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Global Pulse" },
      { name: "description", content: "Intelligence trend analysis and predictive analytics for global events." },
    ],
  }),
  component: AnalyticsPage,
});

// ─── Trend icon helper ────────────────────────────────────────────────────────

function TrendIcon({ dir, className = "h-4 w-4" }: { dir: TrendDirection; className?: string }) {
  if (dir === "increasing") return <TrendingUp className={`${className} text-rose-400`} />;
  if (dir === "improving") return <TrendingDown className={`${className} text-emerald-400`} />;
  return <Minus className={`${className} text-amber-400`} />;
}

// ─── Frequency chart (text-based spark) ──────────────────────────────────────

function FrequencyBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right tabular-nums text-muted-foreground">{label}</span>
      <div className="flex-1 rounded-full bg-secondary/40 overflow-hidden h-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            value === 0 ? "bg-transparent" : pct > 66 ? "bg-rose-500" : pct > 33 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 tabular-nums text-muted-foreground text-right">{value}</span>
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

function AnalyticsPage() {
  const t = useT();
  const [intel, setIntel] = useState<IntelligenceItem[]>([]);
  const [quakes, setQuakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const events = await getLatestEvents({ force, limit: 300 });
      setIntel(toIntelligenceItems(events));
      setQuakes(toEarthquakes(events));
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const trend = useMemo(() => analyzeTrends(intel, quakes), [intel, quakes]);

  // Frequency histogram: events per 2-hour bucket over the last 24h
  const frequencyBuckets = useMemo(() => {
    const now = Date.now();
    const buckets: { label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const startMs = now - (i + 1) * 2 * 3_600_000;
      const endMs = now - i * 2 * 3_600_000;
      const count = intel.filter((e) => {
        const t = new Date(e.publishedAt).getTime();
        return t >= startMs && t < endMs;
      }).length;
      const labelH = Math.round((i + 1) * 2);
      buckets.push({ label: `-${labelH}h`, count });
    }
    return buckets;
  }, [intel]);

  const maxBucket = Math.max(1, ...frequencyBuckets.map((b) => b.count));

  // Severity distribution
  const severityDist = useMemo(() => {
    const now = Date.now();
    const recent = intel.filter((i) => now - new Date(i.publishedAt).getTime() < 6 * 3_600_000);
    return {
      critical: recent.filter((i) => i.severity === "critical").length,
      high: recent.filter((i) => i.severity === "high").length,
      medium: recent.filter((i) => i.severity === "medium").length,
      low: recent.filter((i) => i.severity === "low").length,
    };
  }, [intel]);

  return (
    <div className="page-shell space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHero
        title={t("app.pages.analytics.title")}
        subtitle={t("app.pages.analytics.subtitle")}
        icon={<BarChart2 className="h-5 w-5" />}
        badges={
          <>
            <DataBadge variant="neutral">{t("app.pages.analytics.eventsLoaded", { count: intel.length })}</DataBadge>
            <DataBadge variant="neutral">{t("app.pages.analytics.window24h")}</DataBadge>
            {lastUpdated && (
              <DataBadge variant="source">
                <span suppressHydrationWarning>
                  {t("app.pages.analytics.updatedAt", { time: lastUpdated.toLocaleTimeString() })}
                </span>
              </DataBadge>
            )}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("app.ui.refresh")}
          </Button>
        }
      />

      {loading && !intel.length ? (
        <LoadingSpinner label={t("app.pages.analytics.loading")} />
      ) : intel.length === 0 ? (
        <EmptyState title={t("app.pages.analytics.emptyTitle")} hint={t("app.pages.analytics.emptyHint")} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Left/main: Global trend ────────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">
            {/* Global trend panel */}
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.analytics.globalTrend")}
                subtitle={t("app.pages.analytics.globalTrendSubtitle", {
                  recent: trend.metrics.recentCount,
                  baseline: trend.metrics.baselineCount,
                })}
                right={<TrendBadge direction={trend.direction} label={trend.label} />}
              />
              <div className="mt-4">
                <TrendPanel trend={trend} />
              </div>
            </div>

            {/* Frequency chart */}
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.analytics.eventFrequency")}
                subtitle={t("app.pages.analytics.eventFrequencySubtitle")}
                right={<Clock className="h-4 w-4 text-muted-foreground" />}
              />
              <div className="mt-4 space-y-1.5">
                {frequencyBuckets.map((b, i) => (
                  <FrequencyBar key={i} value={b.count} max={maxBucket} label={b.label} />
                ))}
              </div>
            </div>

            {/* Country trends */}
            {trend.byCountry.length > 0 && (
              <div className="glass-card p-4">
                <SectionHeader
                  title={t("app.pages.analytics.countryTrends")}
                  subtitle={t("app.pages.analytics.countryTrendsSubtitle")}
                  right={<Globe2 className="h-4 w-4 text-muted-foreground" />}
                />
                <div className="mt-3 space-y-2">
                  {trend.byCountry.map((c) => (
                    <div key={c.country} className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/10 px-3 py-2">
                      <TrendIcon dir={c.direction} className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.country}</span>
                          <TrendBadge
                            direction={c.direction}
                            label={
                              c.direction === "increasing"
                                ? t("app.pages.analytics.rising")
                                : c.direction === "improving"
                                  ? t("app.pages.analytics.calming")
                                  : t("app.pages.analytics.stableLabel")
                            }
                          />
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            c.topSeverity === "critical" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
                            c.topSeverity === "high" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-muted-foreground border-border/40"
                          }`}>
                            {c.topSeverity === "critical" || c.topSeverity === "high" || c.topSeverity === "medium" || c.topSeverity === "low"
                              ? t(`app.ui.severity.${c.topSeverity}`)
                              : c.topSeverity}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{c.explanation}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold tabular-nums text-primary">{c.recentCount}</div>
                        <div className="text-[9px] text-muted-foreground">{t("app.pages.analytics.recent")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Severity distribution */}
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.analytics.severityDist")}
                subtitle={t("app.pages.analytics.severityDistSubtitle")}
                right={<Shield className="h-4 w-4 text-muted-foreground" />}
              />
              <div className="mt-3 space-y-2">
                {[
                  { label: t("app.ui.severity.critical"), count: severityDist.critical, color: "bg-rose-500", textColor: "text-rose-400" },
                  { label: t("app.ui.severity.high"), count: severityDist.high, color: "bg-amber-500", textColor: "text-amber-400" },
                  { label: t("app.ui.severity.medium"), count: severityDist.medium, color: "bg-blue-500", textColor: "text-blue-400" },
                  { label: t("app.ui.severity.low"), count: severityDist.low, color: "bg-emerald-500", textColor: "text-emerald-400" },
                ].map((s) => {
                  const total = severityDist.critical + severityDist.high + severityDist.medium + severityDist.low;
                  const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className={s.textColor}>{s.label}</span>
                        <span className="tabular-nums text-muted-foreground">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
                        <div className={`h-full ${s.color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sector trends */}
            {trend.byCategory.length > 0 && (
              <div className="glass-card p-4">
                <SectionHeader
                  title={t("app.pages.analytics.sectorTrends")}
                  subtitle={t("app.pages.analytics.sectorTrendsSubtitle")}
                  right={<Cpu className="h-4 w-4 text-muted-foreground" />}
                />
                <div className="mt-3 space-y-2">
                  {trend.byCategory.slice(0, 8).map((cat) => (
                    <div key={cat.category} className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/10 px-2.5 py-2">
                      <TrendIcon dir={cat.direction} className="h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium capitalize">{cat.category}</span>
                      </div>
                      <span className="tabular-nums text-xs font-bold text-primary">{cat.recentCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend explanation */}
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.analytics.methodology")}
                right={<Activity className="h-4 w-4 text-muted-foreground" />}
              />
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p><strong className="text-foreground">{t("app.pages.analytics.recentWindow")}</strong> {t("app.pages.analytics.recentWindowVal")}</p>
                <p><strong className="text-foreground">{t("app.pages.analytics.baselineWindow")}</strong> {t("app.pages.analytics.baselineWindowVal")}</p>
                <p><strong className="text-foreground">{t("app.pages.analytics.trendScore")}</strong> {t("app.pages.analytics.trendScoreVal")}</p>
                <p><strong className="text-foreground">{t("app.pages.analytics.increasingRisk")}</strong> {t("app.pages.analytics.increasingRiskVal")}</p>
                <p><strong className="text-foreground">{t("app.pages.analytics.improving")}</strong> {t("app.pages.analytics.improvingVal")}</p>
                <p><strong className="text-foreground">{t("app.pages.analytics.stable")}</strong> {t("app.pages.analytics.stableVal")}</p>
                <p className="pt-1 border-t border-border/30">
                  {t("app.pages.analytics.methodologyFooter", { count: intel.length })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
