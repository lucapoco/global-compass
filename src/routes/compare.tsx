/**
 * Comparative Intelligence — GP-013 (enhanced Compare page).
 *
 * Route: /compare
 *
 * Extends the original country comparison with full intelligence integration:
 *  • REST Countries geodata (existing) — population, area, density, languages
 *  • Intelligence feed — filtered events per country
 *  • Risk score comparison — country risk index from riskService
 *  • Nearby earthquakes — USGS data filtered by lat/lng proximity
 *  • AI comparative summary — Gemini-powered side-by-side analysis
 *  • Severity timelines — events per country visualised
 *  • Export (JSON/PDF via exportIntelligence)
 *
 * Architecture decision:
 *  All data loading happens on "Compare" click via Promise.all —
 *  a single coordinated load that fills all sections in one pass.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitCompareArrows, Globe2, Activity, Newspaper, Shield,
  Brain, RefreshCw, Download, Printer, AlertTriangle, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataBadge } from "@/components/ui/DataBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { CountryComparisonChart } from "@/components/charts/CountryComparisonChart";
import { searchCountryByName, getCountriesStatus, subscribeCountriesStatus, type CountriesStatus } from "@/services/countriesApi";
// Centralized Intelligence Store — comparison now spans every active
// provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS,
// World Bank, ...), not just GNews + USGS.
import { getCountryIntelligence } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes, toCountryRiskFromAssessment } from "@/domain/adapters/legacyIntelAdapter";
import { buildNewsContext, sendGlobalPulseAIChat } from "@/services/aiNewsAnalystService";
import { getWeather } from "@/services/weatherApi";
import { exportToPDF, exportToJSON } from "@/utils/exportIntelligence";
import type { Country, IntelligenceItem, Earthquake, CountryRisk, WeatherData } from "@/types";
import type { CountryIntelligenceProfile } from "@/domain/gpie/models/CountryIntelligence";
import { useT } from "@/i18n";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare Countries — Global Pulse" }] }),
  component: ComparePage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareData {
  countryA: Country;
  countryB: Country;
  intelA: IntelligenceItem[];
  intelB: IntelligenceItem[];
  quakesA: Earthquake[];
  quakesB: Earthquake[];
  riskA: CountryRisk | null;
  riskB: CountryRisk | null;
  weatherA: WeatherData | null;
  weatherB: WeatherData | null;
  worldBankA: CountryIntelligenceProfile["worldBankData"];
  worldBankB: CountryIntelligenceProfile["worldBankData"];
  aiSummary?: string;
}

// ─── Risk bar colors ──────────────────────────────────────────────────────────

function riskColor(label: string) {
  if (label === "Critical") return "bg-rose-500 text-rose-400";
  if (label === "High") return "bg-amber-500 text-amber-400";
  if (label === "Medium") return "bg-yellow-500 text-yellow-400";
  return "bg-emerald-500 text-emerald-400";
}

// ─── Page component ───────────────────────────────────────────────────────────

function ComparePage() {
  const t = useT();
  const [aName, setAName] = useState("Romania");
  const [bName, setBName] = useState("Germany");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<IntelligenceItem | null>(null);
  const [countriesStatus, setCountriesStatus] = useState<CountriesStatus>("idle");

  useEffect(() => {
    setCountriesStatus(getCountriesStatus());
    return subscribeCountriesStatus(setCountriesStatus);
  }, []);

  useEffect(() => {
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(async (overrides?: { a?: string; b?: string }) => {
    const queryA = (overrides?.a ?? aName).trim();
    const queryB = (overrides?.b ?? bName).trim();
    setLoading(true); setError(null); setData(null);
    try {
      const [ra, rb] = await Promise.all([
        searchCountryByName(queryA),
        searchCountryByName(queryB),
      ]);

      if (!ra.length || !rb.length) { setError(t("app.toasts.countriesNotFound")); return; }

      const countryA = ra[0];
      const countryB = rb[0];

      const [profileA, profileB, weatherA, weatherB] = await Promise.all([
        getCountryIntelligence(countryA.name.common, countryA.cca2),
        getCountryIntelligence(countryB.name.common, countryB.cca2),
        getWeather(countryA.capital?.[0] ?? countryA.name.common).catch(() => null),
        getWeather(countryB.capital?.[0] ?? countryB.name.common).catch(() => null),
      ]);

      const intelA = toIntelligenceItems(profileA.events);
      const intelB = toIntelligenceItems(profileB.events);
      const quakesA = toEarthquakes(profileA.events).sort((a, b) => b.magnitude - a.magnitude).slice(0, 6);
      const quakesB = toEarthquakes(profileB.events).sort((a, b) => b.magnitude - a.magnitude).slice(0, 6);
      const riskA = toCountryRiskFromAssessment(countryA.name.common, profileA.risk);
      const riskB = toCountryRiskFromAssessment(countryB.name.common, profileB.risk);

      setData({
        countryA,
        countryB,
        intelA,
        intelB,
        quakesA,
        quakesB,
        riskA,
        riskB,
        weatherA,
        weatherB,
        worldBankA: profileA.worldBankData,
        worldBankB: profileB.worldBankData,
      });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("app.errors.loadFailed")); }
    finally { setLoading(false); }
  }, [aName, bName, t]);

  const generateAI = useCallback(async () => {
    if (!data) return;
    setAiLoading(true);
    try {
      const { countryA, countryB, intelA, intelB, riskA, riskB, quakesA, quakesB, worldBankA, worldBankB } = data;
      const prompt = `Compare ${countryA.name.common} and ${countryB.name.common} from an intelligence perspective.

${countryA.name.common}: Population ${(countryA.population ?? 0).toLocaleString()}, Region ${countryA.region}, Risk ${riskA?.score ?? 0}/100 (${riskA?.label ?? "Low"})
${countryB.name.common}: Population ${(countryB.population ?? 0).toLocaleString()}, Region ${countryB.region}, Risk ${riskB?.score ?? 0}/100 (${riskB?.label ?? "Low"})

${countryA.name.common} events (${intelA.length}):
${intelA.slice(0, 5).map((e) => `- [${e.severity}] ${e.title}`).join("\n") || "None"}

${countryB.name.common} events (${intelB.length}):
${intelB.slice(0, 5).map((e) => `- [${e.severity}] ${e.title}`).join("\n") || "None"}

Seismic: ${countryA.name.common} ${quakesA.length} quakes (max M${Math.max(0, ...quakesA.map((q) => q.magnitude)).toFixed(1)}); ${countryB.name.common} ${quakesB.length} quakes (max M${Math.max(0, ...quakesB.map((q) => q.magnitude)).toFixed(1)})

World Bank GDP/capita: ${countryA.name.common} ${worldBankA?.gdpPerCapitaUSD ?? "n/a"}; ${countryB.name.common} ${worldBankB?.gdpPerCapitaUSD ?? "n/a"}

Provide: COMPARATIVE INTELLIGENCE ASSESSMENT, RELATIVE RISK ANALYSIS, KEY DIFFERENTIATORS, INTELLIGENCE CONCLUSION.`;

      const ctx = await buildNewsContext();
      const result = await sendGlobalPulseAIChat([], prompt, ctx);

      if (result.answer) {
        setData((prev) => (prev ? { ...prev, aiSummary: result.answer } : prev));
        if (result.localFallback) {
          toast.message(t("app.toasts.localAnalystBusy"));
        } else if (result.status === "GEMINI ERROR") {
          toast.error(result.errorMessage ?? t("app.toasts.geminiError"));
        } else {
          toast.success(t("app.toasts.aiComparativeGenerated"));
        }
      } else {
        toast.error(result.errorMessage ?? t("app.toasts.aiUnavailable"));
      }
    } catch {
      toast.error(t("app.toasts.aiComparativeFailed"));
    } finally {
      setAiLoading(false);
    }
  }, [data, t]);

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    const { countryA, countryB, intelA, intelB, riskA, riskB } = data;
    exportToPDF({
      title: `Comparative Intelligence: ${countryA.name.common} vs ${countryB.name.common}`,
      type: "Comparative Intelligence Report",
      content: data.aiSummary ?? `Comparative analysis of ${countryA.name.common} and ${countryB.name.common}.\n\n${countryA.name.common}: Risk ${riskA?.score ?? 0}, ${intelA.length} events\n${countryB.name.common}: Risk ${riskB?.score ?? 0}, ${intelB.length} events`,
      events: [...intelA, ...intelB],
      risks: [riskA, riskB].filter(Boolean) as CountryRisk[],
    });
  }, [data]);

  const handleExportJSON = useCallback(() => {
    if (!data) return;
    exportToJSON({
      exportedAt: new Date().toISOString(),
      exportedBy: "Global Pulse Intelligence Platform",
      version: "1.0",
      events: [...data.intelA, ...data.intelB],
      countryRisks: [data.riskA, data.riskB].filter(Boolean) as CountryRisk[],
    }, `compare-${data.countryA.name.common}-${data.countryB.name.common}-${new Date().toISOString().slice(0, 10)}.json`);
  }, [data]);

  // Chart data for visual comparison
  const chartData = useMemo(() => {
    if (!data) return [];
    const { countryA, countryB, riskA, riskB, intelA, intelB, quakesA, quakesB } = data;
    return [
      { label: t("app.pages.compare.populationM"), a: Math.round((countryA.population ?? 0) / 1e6), b: Math.round((countryB.population ?? 0) / 1e6) },
      { label: t("app.pages.compare.areaK"), a: Math.round((countryA.area ?? 0) / 1e3), b: Math.round((countryB.area ?? 0) / 1e3) },
      { label: t("app.pages.compare.riskScore"), a: riskA?.score ?? 0, b: riskB?.score ?? 0 },
      { label: t("app.pages.compare.intelEvents"), a: intelA.length, b: intelB.length },
      { label: t("app.pages.compare.earthquakes"), a: quakesA.length, b: quakesB.length },
    ];
  }, [data, t]);

  const timelineData = useMemo(() => {
    if (!data) return null;
    const DAY = 86_400_000;
    const buckets = [
      t("app.pages.compare.today"),
      t("app.pages.compare.days2to3"),
      t("app.pages.compare.days4to7"),
    ] as const;
    const ranges = [
      { min: 0, max: DAY },
      { min: DAY, max: 3 * DAY },
      { min: 3 * DAY, max: 7 * DAY },
    ];
    const countFor = (items: IntelligenceItem[], min: number, max: number) =>
      items.filter((i) => {
        const age = Date.now() - new Date(i.publishedAt).getTime();
        return age >= min && age < max;
      }).length;

    return buckets.map((label, idx) => ({
      label,
      a: countFor(data.intelA, ranges[idx]!.min, ranges[idx]!.max),
      b: countFor(data.intelB, ranges[idx]!.min, ranges[idx]!.max),
    }));
  }, [data, t]);

  async function onSaveItem(item: IntelligenceItem) {
    const { isSupabaseConfigured, supabaseService } = await import("@/services/supabaseService");
    if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
    try { await supabaseService.saveIntelligence(item); toast.success(t("app.toasts.eventSavedShort")); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")); }
  }

  return (
    <div className="page-shell space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GitCompareArrows className="h-6 w-6 text-primary" />
            {t("app.pages.compare.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("app.pages.compare.subtitle")}
          </p>
        </div>
        <DataBadge variant={countriesStatus === "live" ? "live" : countriesStatus === "local" ? "demo" : "neutral"}>
          REST Countries · {countriesStatus === "idle" ? "loading" : countriesStatus}
        </DataBadge>
      </div>

      {/* ── Search inputs ────────────────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.compare.countryA")}</label>
            <SearchInput value={aName} onChange={setAName} onSubmit={run} placeholder={t("app.pages.compare.placeholderA")} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.compare.countryB")}</label>
            <SearchInput value={bName} onChange={setBName} onSubmit={run} placeholder={t("app.pages.compare.placeholderB")} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void run()} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
            {loading ? t("app.ui.loading") : t("app.pages.compare.compareButton")}
          </Button>
          {data && !loading && (
            <>
              <Button variant="outline" size="sm" onClick={() => void generateAI()} disabled={aiLoading} className="gap-1.5">
                <Brain className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
                {aiLoading ? t("app.pages.compare.analyzing") : t("app.pages.compare.aiAnalysis")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                <Printer className="h-4 w-4" /> {t("app.pages.compare.pdf")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-1.5">
                <Download className="h-4 w-4" /> {t("app.pages.compare.json")}
              </Button>
            </>
          )}
        </div>

        {/* Quick comparison presets */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[10px] text-muted-foreground">{t("app.pages.compare.quick")}</span>
          {[
            ["Ukraine", "Russia"],
            ["Romania", "Poland"],
            ["Germany", "France"],
            ["China", "Japan"],
            ["USA", "China"],
          ].map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              type="button"
              onClick={() => { setAName(a); setBName(b); void run({ a, b }); }}
              className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              {a} vs {b}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner label={t("app.pages.compare.loading")} />}
      {error && <ErrorMessage message={error} />}

      {data && !loading && (
        <div className="space-y-5">
          {/* ── Country cards ──────────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { country: data.countryA, intel: data.intelA, quakes: data.quakesA, risk: data.riskA, label: "A" },
              { country: data.countryB, intel: data.intelB, quakes: data.quakesB, risk: data.riskB, label: "B" },
            ].map(({ country, intel, quakes, risk, label }) => {
              const rc = risk ? riskColor(risk.label) : "bg-emerald-500 text-emerald-400";
              const [barColor, textColor] = rc.split(" ");
              return (
                <div key={country.name.common} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    {country.flags?.svg && (
                      <img src={country.flags.svg} alt={country.name.common} className="h-12 w-16 rounded border border-border/60 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {label === "A" ? t("app.pages.compare.countryA") : t("app.pages.compare.countryB")}
                        </span>
                        {risk && <span className={`text-xs font-bold ${textColor}`}>{risk.score}/100</span>}
                      </div>
                      <h2 className="text-lg font-semibold truncate">
                        <Link to="/country/$name" params={{ name: encodeURIComponent(country.name.common) }} className="hover:text-primary">
                          {country.name.common}
                        </Link>
                      </h2>
                      <p className="text-xs text-muted-foreground">{country.capital?.[0] ?? "—"} · {country.region}</p>
                    </div>
                  </div>

                  {/* Risk bar */}
                  {risk && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.compare.riskLevel")}</span>
                        <span className={`text-[10px] font-bold ${textColor}`}>{risk.label}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
                        <div className={`h-full ${barColor}`} style={{ width: `${risk.score}%` }} />
                      </div>
                      {risk.factors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {risk.factors.slice(0, 3).map((f) => (
                            <span key={f} className="rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Country facts */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Cell k={t("app.pages.compare.population")} v={country.population?.toLocaleString()} />
                    <Cell k={t("app.pages.compare.area")} v={country.area ? `${country.area.toLocaleString()} km²` : "—"} />
                    <Cell k={t("app.pages.compare.intelEvents")} v={intel.length.toString()} />
                    <Cell k={t("app.pages.compare.earthquakes")} v={t("app.pages.compare.earthquakes24h", { count: quakes.length })} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Timeline comparison ─────────────────────────────────────────── */}
          {timelineData && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.compare.timelineTitle")}
                subtitle={t("app.pages.compare.timelineSubtitle")}
                right={<Activity className="h-4 w-4 text-muted-foreground" />}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {timelineData.map((row) => (
                  <div key={row.label} className="rounded-lg border border-border/40 bg-secondary/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{row.label}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">{data.countryA.name.common}</div>
                        <div className="text-lg font-bold tabular-nums text-primary">{row.a}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{data.countryB.name.common}</div>
                        <div className="text-lg font-bold tabular-nums text-emerald-400">{row.b}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Visual chart ────────────────────────────────────────────────── */}
          <div className="glass-card p-4">
            <SectionHeader
              title={t("app.pages.compare.visualTitle")}
              subtitle={t("app.pages.compare.visualSubtitle")}
              right={<DataBadge variant="neutral">{t("app.pages.compare.normalized")}</DataBadge>}
            />
            <CountryComparisonChart
              aName={data.countryA.name.common}
              bName={data.countryB.name.common}
              data={chartData}
            />
          </div>

          {/* ── AI Comparative Summary ──────────────────────────────────────── */}
          {data.aiSummary && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.compare.aiComparativeTitle")}
                subtitle={t("app.pages.compare.aiComparativeSubtitle")}
                right={<Brain className="h-4 w-4 text-primary" />}
              />
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {data.aiSummary}
              </div>
            </div>
          )}

          {/* ── Intelligence comparison ─────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { country: data.countryA, intel: data.intelA, label: "A" },
              { country: data.countryB, intel: data.intelB, label: "B" },
            ].map(({ country, intel, label }) => (
              <div key={country.name.common} className="glass-card p-4">
                <SectionHeader
                  title={t("app.pages.compare.intelTitle", { country: country.name.common })}
                  subtitle={t("app.pages.compare.intelSubtitle", { count: intel.length })}
                  right={<Newspaper className="h-4 w-4 text-muted-foreground" />}
                />
                {intel.length === 0 ? (
                  <EmptyState title={t("app.pages.compare.noEvents")} hint={t("app.pages.compare.noEventsHint")} />
                ) : (
                  <div className="mt-3 space-y-2">
                    {intel.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/10 p-2">
                        <SeverityBadge severity={item.severity} />
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setActiveModal(item)} className="text-left">
                            <div className="line-clamp-2 text-xs font-medium hover:text-primary">{item.title}</div>
                          </button>
                          <div className="text-[10px] text-muted-foreground">{item.source} · {item.category}</div>
                        </div>
                        <button type="button" onClick={() => setActiveModal(item)} className="shrink-0 rounded border border-border/50 p-1 text-muted-foreground hover:text-primary">
                          <Eye className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Earthquake comparison ───────────────────────────────────────── */}
          {(data.quakesA.length > 0 || data.quakesB.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { country: data.countryA, quakes: data.quakesA },
                { country: data.countryB, quakes: data.quakesB },
              ].map(({ country, quakes }) => (
                <div key={country.name.common} className="glass-card p-4">
                  <SectionHeader
                    title={t("app.pages.compare.seismicTitle", { country: country.name.common })}
                    subtitle={t("app.pages.compare.seismicSubtitle", { count: quakes.length })}
                    right={<Activity className="h-4 w-4 text-amber-400" />}
                  />
                  {quakes.length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">No significant seismic activity detected.</div>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {quakes.map((q) => (
                        <div key={q.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/10 px-3 py-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-400">
                            {q.magnitude.toFixed(1)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{q.place}</div>
                            <div className="text-[10px] text-muted-foreground">Depth {q.depth.toFixed(0)} km</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Weather comparison ──────────────────────────────────────────── */}
          {(data.weatherA || data.weatherB) && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { country: data.countryA, weather: data.weatherA },
                { country: data.countryB, weather: data.weatherB },
              ].map(({ country, weather }) => (
                <div key={country.name.common} className="glass-card p-4">
                  <SectionHeader
                    title={t("app.pages.compare.weatherTitle", { country: country.name.common })}
                    subtitle={country.capital?.[0] ?? t("app.pages.compare.capital")}
                    right={<Globe2 className="h-4 w-4 text-cyan-400" />}
                  />
                  {weather ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Cell k={t("app.pages.compare.condition")} v={weather.description} />
                      <Cell k={t("app.pages.compare.temperature")} v={`${Math.round(weather.temperature)}°C`} />
                      <Cell k={t("app.pages.compare.feelsLike")} v={`${Math.round(weather.feelsLike)}°C`} />
                      <Cell k={t("app.pages.compare.humidity")} v={`${weather.humidity}%`} />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">Weather data unavailable for this location.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Economic indicators (World Bank) ────────────────────────────── */}
          {(data.worldBankA || data.worldBankB) && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { country: data.countryA, wb: data.worldBankA },
                { country: data.countryB, wb: data.worldBankB },
              ].map(({ country, wb }) => (
                <div key={country.name.common} className="glass-card p-4">
                  <SectionHeader
                    title={t("app.pages.compare.economyTitle", { country: country.name.common })}
                    subtitle={t("app.pages.compare.economySubtitle")}
                    right={<Shield className="h-4 w-4 text-emerald-400" />}
                  />
                  {wb ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Cell k={t("app.pages.compare.gdpPerCapita")} v={wb.gdpPerCapitaUSD != null ? `$${wb.gdpPerCapitaUSD.toLocaleString()}` : "—"} />
                      <Cell k={t("app.pages.compare.population")} v={wb.population != null ? wb.population.toLocaleString() : "—"} />
                      <Cell k={t("app.pages.compare.lifeExpectancy")} v={wb.lifeExpectancy != null ? `${wb.lifeExpectancy} yrs` : "—"} />
                      <Cell k={t("app.pages.compare.unemployment")} v={wb.unemploymentPct != null ? `${wb.unemploymentPct}%` : "—"} />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">World Bank data unavailable.</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Intelligence insight ────────────────────────────────────────── */}
          <div className="glass-card p-4">
            <SectionHeader title={t("app.pages.compare.insightTitle")} right={<AlertTriangle className="h-4 w-4 text-amber-400" />} />
            <p className="mt-2 text-sm text-muted-foreground">
              {buildInsight(data)}
            </p>
            {!data.aiSummary && (
              <button
                type="button"
                onClick={() => void generateAI()}
                disabled={aiLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
              >
                <Brain className={`h-3.5 w-3.5 ${aiLoading ? "animate-spin" : ""}`} />
                {aiLoading ? t("app.pages.compare.generatingAi") : t("app.pages.compare.generateAi")}
              </button>
            )}
          </div>
        </div>
      )}

      <IntelligenceDetailsModal item={activeModal} onClose={() => setActiveModal(null)} onSave={onSaveItem} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Cell({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-xs">{v ?? "—"}</div>
    </div>
  );
}

function buildInsight(data: CompareData): string {
  const { countryA, countryB, riskA, riskB, intelA, intelB } = data;
  const parts: string[] = [];

  if (riskA && riskB) {
    if (riskA.score > riskB.score + 10) {
      parts.push(`${countryA.name.common} currently faces a higher threat environment (Risk: ${riskA.score} vs ${riskB.score}).`);
    } else if (riskB.score > riskA.score + 10) {
      parts.push(`${countryB.name.common} currently faces a higher threat environment (Risk: ${riskB.score} vs ${riskA.score}).`);
    } else {
      parts.push(`Both countries show comparable risk levels (${countryA.name.common}: ${riskA.score}, ${countryB.name.common}: ${riskB.score}).`);
    }
  }

  if (intelA.length > intelB.length + 2) {
    parts.push(`${countryA.name.common} has significantly more intelligence activity (${intelA.length} vs ${intelB.length} events).`);
  } else if (intelB.length > intelA.length + 2) {
    parts.push(`${countryB.name.common} has significantly more intelligence activity (${intelB.length} vs ${intelA.length} events).`);
  }

  const popDiff = (countryA.population ?? 0) - (countryB.population ?? 0);
  if (Math.abs(popDiff) > 5_000_000) {
    const larger = popDiff > 0 ? countryA.name.common : countryB.name.common;
    parts.push(`${larger} has a substantially larger population base, influencing both economic capacity and vulnerability surface.`);
  }

  if (parts.length === 0) return `${countryA.name.common} and ${countryB.name.common} show similar intelligence profiles. Generate an AI analysis for detailed comparison.`;
  return parts.join(" ");
}
