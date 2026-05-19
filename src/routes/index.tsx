import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, Activity, Flag, Bookmark, AlertTriangle, ArrowRight, Newspaper, Sparkles, FileText } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EarthquakeMagnitudeChart } from "@/components/charts/EarthquakeMagnitudeChart";
import { RiskScoreCard } from "@/components/intelligence/RiskScoreCard";
import { DashboardStatusBar } from "@/components/dashboard/StatusBar";
import { LiveIntelligencePanel } from "@/components/dashboard/LiveIntelligencePanel";
import { CriticalSignalsPanel } from "@/components/dashboard/CriticalSignalsPanel";
import { CategoryDistributionChart } from "@/components/dashboard/CategoryDistributionChart";
import { WorldActivityTimeline } from "@/components/dashboard/WorldActivityTimeline";
import { MapPreview } from "@/components/dashboard/MapPreview";
import { ApiHealthPanel } from "@/components/dashboard/ApiHealthPanel";
import { LiveVideoPanel } from "@/components/video/LiveVideoPanel";
import { getDashboardSnapshot, invalidateDashboardCache, type DashboardSnapshot } from "@/services/dashboardService";
import { useViewMode } from "@/context/ViewModeContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Global Pulse" },
      { name: "description", content: "Live planetary monitoring dashboard: earthquakes, intelligence, alerts and saved data." },
    ],
  }),
  component: DashboardPage,
});

const REFRESH_COOLDOWN_MS = 60_000;

function DashboardPage() {
  const { isSimple } = useViewMode();
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date>(new Date());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function load(force = false) {
    setLoading(true);
    try {
      if (force) invalidateDashboardCache();
      const s = await getDashboardSnapshot(force);
      setSnap(s);
      setUpdated(new Date());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to refresh");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function onRefresh() {
    if (loading) return;
    if (now < cooldownUntil) { toast.message("Please wait before refreshing again."); return; }
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    load(true);
  }
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const quakes = snap?.quakes ?? [];
  const intel = snap?.intel ?? [];
  const saved = snap?.savedAlerts ?? [];
  const today = quakes.length;
  const maxMag = quakes.length ? Math.max(...quakes.map((q) => q.magnitude)) : 0;
  const intelCounts = intel.reduce((r, i) => { r[i.severity]++; return r; }, { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>);

  return (
    <div className="space-y-5">
      <DashboardStatusBar
        status={snap?.newsStatus ?? "demo"}
        updated={updated}
        loading={loading}
        cooldownLeft={cooldownLeft}
        onRefresh={onRefresh}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Countries monitored" value={snap?.countryCount ?? "—"} hint="REST Countries API" icon={<Flag className="h-4 w-4" />} accent="cyan" />
        <StatCard label="Earthquakes today" value={snap ? today : "—"} hint="USGS feed" icon={<Activity className="h-4 w-4" />} accent="amber" />
        <StatCard label="Highest magnitude" value={snap ? maxMag.toFixed(1) : "—"} hint="USGS feed" icon={<Activity className="h-4 w-4" />} accent="rose" />
        <StatCard label="Intel critical+high" value={snap ? intelCounts.critical + intelCounts.high : "—"} hint={snap?.newsStatus === "live" ? "GNews · Live" : (snap?.newsStatus ?? "—").toString()} icon={<Newspaper className="h-4 w-4" />} accent="rose" />
        <StatCard label="Saved countries" value={snap?.savedCountriesCount ?? "—"} hint="Backend" icon={<Bookmark className="h-4 w-4" />} accent="emerald" />
        <StatCard label="Active alerts" value={saved.length} hint="Saved" icon={<AlertTriangle className="h-4 w-4" />} accent="amber" />
      </div>

      {/* Row 1: Map preview + Live Intelligence + Country Risk */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <MapPreview earthquakeCount={today} intelCount={intel.length} alertCount={saved.length} />
        </div>
        <div className="xl:col-span-6">
          <LiveIntelligencePanel
            items={snap ? intel : null}
            status={snap?.newsStatus ?? "demo"}
            loading={loading}
            cooldownLeft={cooldownLeft}
            onRefresh={onRefresh}
          />
        </div>
        <div className="glass-card p-4 xl:col-span-3">
          <SectionHeader title="Country Risk" subtitle="Top 5 by combined risk" right={<DataBadge variant="neutral">0–100</DataBadge>} />
          <div className="space-y-2">
            {!snap ? <div className="h-32 animate-pulse rounded bg-secondary/40" />
              : snap.risks.length === 0 ? <div className="text-xs text-muted-foreground">Computing risk index…</div>
              : snap.risks.slice(0, 5).map((r, idx) => <RiskScoreCard key={r.country} rank={idx + 1} risk={r} />)}
          </div>
          <Link to="/intelligence" className="mt-2 inline-block text-[11px] text-primary hover:underline">See full index →</Link>
        </div>
      </div>

      {/* Row 2: Live Video Monitor + Critical Signals */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LiveVideoPanel />
        <CriticalSignalsPanel intel={intel} quakes={quakes} saved={saved} />
      </div>

      {/* Row 3: Earthquake chart + Activity feed (advanced only) */}
      {!isSimple && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-card p-4 lg:col-span-2">
            <SectionHeader title="Earthquake magnitudes — last 24h" subtitle="Distribution by Richter bucket" right={<DataBadge variant="source">USGS</DataBadge>} />
            {snap ? <EarthquakeMagnitudeChart data={quakes} /> : <div className="h-56 animate-pulse rounded bg-secondary/40" />}
          </div>
          <CategoryDistributionChart items={intel} />
        </div>
      )}

      {/* Row 4: API Health + Activity timeline (advanced only) */}
      {!isSimple && (
        <div id="api-health" className="grid gap-4 lg:grid-cols-2">
          <ApiHealthPanel />
          <WorldActivityTimeline intel={intel} quakes={quakes} saved={saved} />
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { to: "/ai-news", label: "Ask Global Pulse AI", icon: Sparkles },
          { to: "/reports", label: "Generate Report", icon: FileText },
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
