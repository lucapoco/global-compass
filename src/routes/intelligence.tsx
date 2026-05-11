import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Radio, Activity, ShieldAlert, Info } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntelligenceCard } from "@/components/intelligence/IntelligenceCard";
import { IntelligenceFilters } from "@/components/intelligence/IntelligenceFilters";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { RiskScoreCard } from "@/components/intelligence/RiskScoreCard";
import { fetchIntelligence, isNewsConfigured } from "@/services/newsApi";
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

export default function IntelligencePage() {
  const [items, setItems] = useState<IntelligenceItem[] | null>(null);
  const [status, setStatus] = useState<"live" | "demo" | "error">("demo");
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IntelligenceCategory | "all">("all");
  const [severity, setSeverity] = useState<IntelligenceSeverity | "all">("all");
  const [active, setActive] = useState<IntelligenceItem | null>(null);
  const [updated, setUpdated] = useState(new Date());
  const [risks, setRisks] = useState<CountryRisk[]>([]);

  async function load(searchQuery?: string) {
    setItems(null);
    const r = await fetchIntelligence({ query: searchQuery, max: 30 });
    setItems(r.items);
    setStatus(r.status);
    setStatusMsg(r.message);
    setUpdated(new Date());

    // Build risk index
    let quakes: Earthquake[] = [];
    let saved: SavedAlert[] = [];
    try { quakes = await getEarthquakes("day"); } catch {}
    if (isSupabaseConfigured()) {
      try { saved = await supabaseService.listSavedAlerts(); } catch {}
    }
    setRisks(buildCountryRiskIndex({ intel: r.items, quakes, saved }));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      return true;
    });
  }, [items, category, severity]);

  const counts = useMemo(() => {
    const r = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of filtered) r[i.severity]++;
    return r;
  }, [filtered]);

  async function handleSave(item: IntelligenceItem) {
    if (!isSupabaseConfigured()) { toast.error("Supabase not configured."); return; }
    try {
      await supabaseService.saveIntelligence(item);
      toast.success("Saved intelligence item.");
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Radio className="h-5 w-5 text-primary" /> Live Intelligence Feed
          </h1>
          <p className="text-xs text-muted-foreground">Global headlines normalized into actionable intelligence items</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataBadge variant={status === "live" ? "live" : status === "error" ? "error" : "demo"}>
            {status === "live" ? "Live API" : status === "error" ? "API error" : "Demo data"}
          </DataBadge>
          {!isNewsConfigured() && <DataBadge variant="neutral">Set VITE_GNEWS_API_KEY</DataBadge>}
          <DataBadge variant="neutral">Updated {updated.toLocaleTimeString()}</DataBadge>
          <button
            onClick={() => load(query.trim() || undefined)}
            disabled={items === null}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${items === null ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {statusMsg && status !== "live" && <ErrorMessage message={statusMsg} />}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Critical", value: counts.critical, color: "text-rose-glow" },
          { label: "High", value: counts.high, color: "text-amber-glow" },
          { label: "Medium", value: counts.medium, color: "text-cyan-glow" },
          { label: "Low", value: counts.low, color: "text-emerald-glow" },
        ].map((t) => (
          <div key={t.label} className="glass-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${t.color}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <IntelligenceFilters
        query={query} setQuery={setQuery}
        category={category} setCategory={setCategory}
        severity={severity} setSeverity={setSeverity}
        onSearch={() => load(query.trim() || undefined)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          <SectionHeader title="Headlines" subtitle={items ? `${filtered.length} of ${items.length} items` : ""} />
          {!items && <LoadingSpinner label="Fetching intelligence…" />}
          {items && filtered.length === 0 && <EmptyState title="No items match your filters" />}
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((i) => (
              <IntelligenceCard key={i.id} item={i} onOpen={setActive} onSave={handleSave} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader title="Country Risk Index"
            subtitle="Top 10 countries by combined risk"
            right={<ShieldAlert className="h-4 w-4 text-amber-glow" />} />
          {risks.length === 0
            ? <EmptyState title="No risk signals yet" hint="Risk appears after intelligence + earthquake data is loaded." />
            : risks.map((r, idx) => <RiskScoreCard key={r.country} rank={idx + 1} risk={r} />)}

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
            GNews / NewsAPI · USGS Earthquakes · Supabase saved alerts
          </div>
        </div>
      </div>

      <IntelligenceDetailsModal item={active} onClose={() => setActive(null)} onSave={handleSave} />
    </div>
  );
}
