import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Radio, Activity, ShieldAlert, Info, RefreshCw, LayoutGrid, List } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/button";
import { IntelligenceCard } from "@/components/intelligence/IntelligenceCard";
import { IntelligenceFilters } from "@/components/intelligence/IntelligenceFilters";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { RiskScoreCard } from "@/components/intelligence/RiskScoreCard";
import {
  fetchIntelligence,
  isNewsConfigured,
  clearNewsCache,
  sortIntelligenceItems,
  type NewsStatus,
  type IntelligenceSortMode,
} from "@/services/newsApi";
import { getEarthquakes } from "@/services/earthquakesApi";
import { buildCountryRiskIndex, RISK_WEIGHTS } from "@/services/riskService";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { IntelligenceItem, IntelligenceCategory, IntelligenceSeverity, CountryRisk, Earthquake, SavedAlert } from "@/types";

export const Route = createFileRoute("/intelligence")({
  head: () => ({
    meta: [
      { title: "Live Intelligence Feed — Global Pulse" },
      { name: "description", content: "Real-time global intelligence feed: news, geopolitics, conflict, cyber, climate." },
    ],
  }),
  component: IntelligencePage,
});

const REFRESH_COOLDOWN_MS = 60_000;
const INITIAL_VISIBLE = 20;
const LOAD_MORE_STEP = 10;

function statusLabel(s: NewsStatus, msg?: string): string {
  if (s === "rate_limited" && msg?.toLowerCase().includes("quota")) return "QUOTA REACHED";
  switch (s) {
    case "live":
      return "LIVE";
    case "cached":
      return "CACHED LIVE DATA";
    case "rate_limited":
      return "RATE LIMITED";
    case "error":
      return "API ERROR";
    default:
      return "DEMO";
  }
}

function statusVariant(s: NewsStatus): "live" | "demo" | "error" | "neutral" {
  if (s === "live") return "live";
  if (s === "cached") return "neutral";
  if (s === "rate_limited" || s === "error") return "error";
  return "demo";
}

export default function IntelligencePage() {
  const [items, setItems] = useState<IntelligenceItem[] | null>(null);
  const [status, setStatus] = useState<NewsStatus>("demo");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [fetchedTotal, setFetchedTotal] = useState(0);
  const [newsSource, setNewsSource] = useState<string>("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IntelligenceCategory | "all">("all");
  const [severity, setSeverity] = useState<IntelligenceSeverity | "all">("all");
  const [sortMode, setSortMode] = useState<IntelligenceSortMode>("newest");
  const [viewLayout, setViewLayout] = useState<"compact" | "detailed">("compact");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [active, setActive] = useState<IntelligenceItem | null>(null);
  const [updated, setUpdated] = useState(new Date());
  const [risks, setRisks] = useState<CountryRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [category, severity, query, sortMode]);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    setLoading(true);
    if (opts?.force) setItems(null);
    try {
      const r = await fetchIntelligence({ limit: 30, force: opts?.force });
      setItems(r.items);
      setStatus(r.status);
      setStatusMsg(r.message ?? r.errorMessage);
      setFetchedTotal(r.fetchedTotal ?? r.items.length);
      setNewsSource(r.source);
      setUpdated(new Date());

      let quakes: Earthquake[] = [];
      let saved: SavedAlert[] = [];
      try {
        quakes = await getEarthquakes("day");
      } catch {
        /* ignore */
      }
      if (isSupabaseConfigured()) {
        try {
          saved = await supabaseService.listSavedAlerts();
        } catch {
          /* ignore */
        }
      }
      setRisks(buildCountryRiskIndex({ intel: r.items, quakes, saved }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleRefresh() {
    if (loading) return;
    if (nowTick < cooldownUntil) {
      toast.message("Please wait before refreshing again.");
      return;
    }
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    void load({ force: true });
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  const refreshDisabled = loading || cooldownLeft > 0;

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (q) {
        const blob = [i.title, i.description, i.source, i.country, i.category, i.severity]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, severity, query]);

  const sorted = useMemo(() => sortIntelligenceItems(filtered, sortMode), [filtered, sortMode]);

  const effectiveVisible = Math.min(visibleCount, sorted.length);
  const displayed = useMemo(() => sorted.slice(0, effectiveVisible), [sorted, effectiveVisible]);

  const counts = useMemo(() => {
    const r = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of filtered) r[i.severity]++;
    return r;
  }, [filtered]);

  async function handleSave(item: IntelligenceItem) {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    try {
      await supabaseService.saveIntelligence(item);
      toast.success("Event saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const statusHeadline = `${statusLabel(status, statusMsg)} · ${fetchedTotal || items?.length || 0} items`;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
              <Radio className="h-8 w-8 shrink-0 text-primary" />
              Live Intelligence
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Monitoring workspace for normalized global headlines — search, filter, and triage signals before they hit
              the map or alerts.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <DataBadge variant={statusVariant(status)}>{statusHeadline}</DataBadge>
              {newsSource ? <DataBadge variant="source">{newsSource}</DataBadge> : null}
              {!isNewsConfigured() ? <DataBadge variant="neutral">Configure GNews key</DataBadge> : null}
              <DataBadge variant="neutral">Updated {updated.toLocaleString()}</DataBadge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshDisabled}
              title={cooldownLeft > 0 ? `Please wait ${cooldownLeft}s before refreshing again.` : "Refresh feed"}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/15 px-4 py-2 text-sm text-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Refresh"}
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => {
                  clearNewsCache();
                  toast.success("News cache cleared.");
                  void load({ force: true });
                }}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Clear cache
              </button>
            )}
          </div>
        </div>
      </div>

      {statusMsg && status !== "live" ? <ErrorMessage message={statusMsg} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Critical", value: counts.critical, color: "text-rose-glow" },
          { label: "High", value: counts.high, color: "text-amber-glow" },
          { label: "Medium", value: counts.medium, color: "text-cyan-glow" },
          { label: "Low", value: counts.low, color: "text-emerald-glow" },
        ].map((t) => (
          <div key={t.label} className="glass-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className={`mt-1 text-3xl font-semibold tabular-nums ${t.color}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <IntelligenceFilters
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={setCategory}
        severity={severity}
        setSeverity={setSeverity}
        instantSearch
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-secondary/10 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort</span>
          {(
            [
              ["newest", "Newest first"],
              ["severity", "Highest severity"],
              ["source", "Source"],
              ["category", "Category"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSortMode(value)}
              className={`rounded-md border px-2.5 py-1 text-[11px] ${
                sortMode === value ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">View</span>
          <Button
            type="button"
            variant={viewLayout === "compact" ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setViewLayout("compact")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Compact
          </Button>
          <Button
            type="button"
            variant={viewLayout === "detailed" ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setViewLayout("detailed")}
          >
            <List className="h-3.5 w-3.5" /> Detailed
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <SectionHeader
            title="Headlines"
            subtitle={
              items
                ? `${displayed.length} shown · ${sorted.length} after filters · ${items.length} in current load`
                : "Loading…"
            }
          />
          {!items && loading ? <LoadingSpinner label="Fetching intelligence…" /> : null}
          {loading && items ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg border border-border/40 bg-secondary/30" />
              ))}
            </div>
          ) : null}
          {items && filtered.length === 0 ? (
            <EmptyState title="No items match your filters" hint="Clear search or reset category / severity." />
          ) : null}
          {items && filtered.length > 0 ? (
            <div className={`grid gap-3 ${viewLayout === "detailed" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              {displayed.map((i) => (
                <IntelligenceCard
                  key={i.id}
                  item={i}
                  newsStatus={status}
                  layout={viewLayout}
                  onOpen={setActive}
                  onSave={handleSave}
                />
              ))}
            </div>
          ) : null}
          {items && sorted.length > effectiveVisible ? (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" onClick={() => setVisibleCount((v) => v + LOAD_MORE_STEP)}>
                Load more ({sorted.length - effectiveVisible} remaining)
              </Button>
            </div>
          ) : null}
          {items && sorted.length > 0 && effectiveVisible >= sorted.length && sorted.length > INITIAL_VISIBLE ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">No more articles in this view.</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="Country Risk Index"
            subtitle="Top 10 countries by combined risk"
            right={<ShieldAlert className="h-4 w-4 text-amber-glow" />}
          />
          {risks.length === 0 ? (
            <EmptyState title="No risk signals yet" hint="Risk appears after intelligence + earthquake data is loaded." />
          ) : (
            risks.slice(0, 10).map((r, idx) => <RiskScoreCard key={r.country} rank={idx + 1} risk={r} />)
          )}

          <div className="glass-card p-3 text-[11px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-foreground">
              <Info className="h-3.5 w-3.5" /> How the score is calculated
            </div>
            <ul className="space-y-0.5">
              <li>+{RISK_WEIGHTS.critical} per critical news item</li>
              <li>+{RISK_WEIGHTS.high} per high item</li>
              <li>+{RISK_WEIGHTS.medium} per medium item</li>
              <li>+{RISK_WEIGHTS.low} per low item</li>
              <li>+{RISK_WEIGHTS.quake6} for any M6+ earthquake</li>
              <li>+{RISK_WEIGHTS.quake5} for any M5+ earthquake</li>
              <li>+{RISK_WEIGHTS.savedCritical} per saved critical alert</li>
              <li>Score is capped at 100.</li>
            </ul>
          </div>

          <div className="glass-card p-3 text-[11px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-foreground">
              <Activity className="h-3.5 w-3.5" /> Data sources
            </div>
            GNews proxy · optional NewsAPI fallback · USGS · Supabase saved alerts
          </div>
        </div>
      </div>

      <IntelligenceDetailsModal item={active} onClose={() => setActive(null)} onSave={handleSave} />
    </div>
  );
}
