import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Globe2, Activity, Flag, Bookmark, AlertTriangle, CloudSun, ArrowRight, Newspaper, ShieldAlert } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EarthquakeMagnitudeChart } from "@/components/charts/EarthquakeMagnitudeChart";
import { IntelligenceCard } from "@/components/intelligence/IntelligenceCard";
import { RiskScoreCard } from "@/components/intelligence/RiskScoreCard";
import { getEarthquakes } from "@/services/earthquakesApi";
import { getAllCountries } from "@/services/countriesApi";
import { fetchIntelligence } from "@/services/newsApi";
import { buildCountryRiskIndex } from "@/services/riskService";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { Earthquake, IntelligenceItem, CountryRisk } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Global Pulse" },
      { name: "description", content: "Live planetary monitoring dashboard: earthquakes, intelligence, alerts and saved data." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [quakes, setQuakes] = useState<Earthquake[] | null>(null);
  const [quakeError, setQuakeError] = useState(false);
  const [countryCount, setCountryCount] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [updated, setUpdated] = useState<Date>(new Date());
  const [intel, setIntel] = useState<IntelligenceItem[] | null>(null);
  const [intelStatus, setIntelStatus] = useState<"live" | "demo" | "error">("demo");
  const [risks, setRisks] = useState<CountryRisk[]>([]);

  useEffect(() => {
    (async () => {
      const qP = getEarthquakes("day").then((q) => { setQuakes(q); return q; }).catch(() => { setQuakeError(true); return [] as Earthquake[]; });
      getAllCountries().then((c) => setCountryCount(c.length)).catch(() => setCountryCount(null));
      let savedAlerts: any[] = [];
      if (isSupabaseConfigured()) {
        supabaseService.listSavedCountries().then((d) => setSavedCount(d.length)).catch(() => setSavedCount(0));
        try { savedAlerts = await supabaseService.listSavedAlerts(); setAlertCount(savedAlerts.length); }
        catch { setAlertCount(0); }
      }
      const news = await fetchIntelligence({ max: 20 });
      setIntel(news.items);
      setIntelStatus(news.status);
      const quakesNow = await qP;
      setRisks(buildCountryRiskIndex({ intel: news.items, quakes: quakesNow, saved: savedAlerts }));
      setUpdated(new Date());
    })();
  }, []);

  const today = quakes?.length ?? 0;
  const maxMag = quakes && quakes.length ? Math.max(...quakes.map((q) => q.magnitude)) : 0;
  const intelCounts = useMemo(() => {
    const r = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    for (const i of intel ?? []) r[i.severity]++;
    return r;
  }, [intel]);
  const categoryCounts = useMemo(() => {
    const r = new Map<string, number>();
    for (const i of intel ?? []) r.set(i.category, (r.get(i.category) ?? 0) + 1);
    return Array.from(r.entries()).sort((a, b) => b[1] - a[1]);
  }, [intel]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-card panel-grid relative overflow-hidden p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-glow/15 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <DataBadge variant="live">Live</DataBadge>
              {quakeError && <DataBadge variant="error">API error</DataBadge>}
              {!isSupabaseConfigured() && <DataBadge variant="demo">Supabase not configured</DataBadge>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">Global Pulse</h1>
            <p className="mt-1 text-sm text-muted-foreground">Real-time insights about our planet</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Last updated · {updated.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/map" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">Explore Map</Link>
            <Link to="/countries" className="rounded-md border border-border/60 px-3 py-2 text-xs">Search Country</Link>
            <Link to="/earthquakes" className="rounded-md border border-border/60 px-3 py-2 text-xs">View Earthquakes</Link>
            <Link to="/compare" className="rounded-md border border-border/60 px-3 py-2 text-xs">Compare</Link>
            <Link to="/saved" className="rounded-md border border-border/60 px-3 py-2 text-xs">Saved Data</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Countries monitored" value={countryCount ?? "—"} hint="REST Countries API" icon={<Flag className="h-4 w-4" />} accent="cyan" />
        <StatCard label="Earthquakes today" value={quakes ? today : "—"} hint="USGS feed" icon={<Activity className="h-4 w-4" />} accent="amber" />
        <StatCard label="Highest magnitude" value={quakes ? maxMag.toFixed(1) : "—"} hint="USGS feed" icon={<Activity className="h-4 w-4" />} accent="rose" />
        <StatCard label="Intel critical+high" value={intel ? intelCounts.critical + intelCounts.high : "—"} hint={intelStatus === "live" ? "GNews · Live" : "Demo feed"} icon={<Newspaper className="h-4 w-4" />} accent="rose" />
        <StatCard label="Saved countries" value={savedCount ?? "—"} hint="Supabase" icon={<Bookmark className="h-4 w-4" />} accent="emerald" />
        <StatCard label="Active alerts" value={alertCount ?? "—"} hint="Saved + USGS" icon={<AlertTriangle className="h-4 w-4" />} accent="amber" />
      </div>

      {/* Chart + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Earthquake magnitudes — last 24h" subtitle="Distribution by Richter bucket" right={<DataBadge variant="source">USGS</DataBadge>} />
          {quakes ? <EarthquakeMagnitudeChart data={quakes} /> : <div className="h-56 animate-pulse rounded bg-secondary/40" />}
        </div>
        <div className="glass-card p-4">
          <SectionHeader title="World activity feed" subtitle="Most recent quakes" right={<DataBadge variant="live">Live</DataBadge>} />
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {(quakes ?? []).slice(0, 8).map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{q.place}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(q.time).toLocaleTimeString()}</div>
                </div>
                <span className="tabular-nums text-sm font-semibold text-amber-glow">M{q.magnitude.toFixed(1)}</span>
              </div>
            ))}
            {quakes && quakes.length === 0 && <p className="text-xs text-muted-foreground">No earthquakes in the last day.</p>}
          </div>
        </div>
      </div>

      {/* Intelligence + Risk */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-4 lg:col-span-2">
          <SectionHeader
            title="Live Intelligence Feed"
            subtitle="Latest 5 normalized headlines"
            right={
              <div className="flex items-center gap-2">
                <DataBadge variant={intelStatus === "live" ? "live" : intelStatus === "error" ? "error" : "demo"}>
                  {intelStatus === "live" ? "Live" : intelStatus === "error" ? "API error" : "Demo"}
                </DataBadge>
                <Link to="/intelligence" className="text-[11px] text-primary hover:underline">Open feed →</Link>
              </div>
            }
          />
          {!intel ? <div className="h-40 animate-pulse rounded bg-secondary/40" /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {intel.slice(0, 5).map((i) => <IntelligenceCard key={i.id} item={i} />)}
            </div>
          )}
          {intel && categoryCounts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categoryCounts.map(([cat, n]) => (
                <span key={cat} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {cat} · {n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card p-4">
          <SectionHeader title="Country Risk" subtitle="Top 5 by combined risk" right={<ShieldAlert className="h-4 w-4 text-amber-glow" />} />
          <div className="space-y-2">
            {risks.length === 0
              ? <div className="text-xs text-muted-foreground">Computing risk index…</div>
              : risks.slice(0, 5).map((r, idx) => <RiskScoreCard key={r.country} rank={idx + 1} risk={r} />)}
          </div>
          <Link to="/intelligence" className="mt-2 inline-block text-[11px] text-primary hover:underline">See full index →</Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/intelligence", label: "Intelligence Feed", icon: Newspaper },
          { to: "/map", label: "Live World Map", icon: Globe2 },
          { to: "/countries", label: "Countries", icon: Flag },
          { to: "/earthquakes", label: "Earthquakes", icon: Activity },
          { to: "/alerts", label: "Global Alerts", icon: AlertTriangle },
        ].map((q) => {
          const I = q.icon;
          return (
            <Link key={q.to} to={q.to} className="glass-card group flex items-center justify-between p-4 hover:border-primary/40">
              <div className="flex items-center gap-3">
                <I className="h-4 w-4 text-primary" />
                <span className="text-sm">{q.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
