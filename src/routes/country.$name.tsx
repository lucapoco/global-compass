/**
 * Country Intelligence Center — GP-008 (redesigned).
 *
 * Route: /country/$name
 *
 * Transforms a basic country info page into a full intelligence dashboard:
 *  • Hero header with flag, risk tier, stability bar, and quick actions
 *  • AI Country Briefing auto-generated on load (Gemini, with local fallback)
 *  • Intelligence timeline with Today / 7d / 30d / All filters
 *  • Severity distribution chart
 *  • Country-specific trending topics
 *  • Related countries (border nations) with quick navigation
 *  • Seismic activity panel
 *  • Geographic profile sidebar
 *  • Risk assessment breakdown
 *
 * All data comes from existing services — no new APIs introduced.
 */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Globe2, Users, MapPin, TrendingUp, Activity,
  Newspaper, Brain, AlertTriangle, Shield, ExternalLink,
  Eye, RefreshCw, Hash, ChevronRight, Clock, Sparkles,
  GitCompareArrows, BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { DataBadge } from "@/components/ui/DataBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { searchCountryByName, getCountriesStatus, subscribeCountriesStatus, type CountriesStatus } from "@/services/countriesApi";
import { buildNewsContext, sendGlobalPulseAIChat } from "@/services/aiNewsAnalystService";
// Centralized Intelligence Store — country profile now spans every active
// provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS,
// World Bank, ...), not just GNews + USGS.
import { getCountryIntelligence } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes, toCountryRiskFromAssessment } from "@/domain/adapters/legacyIntelAdapter";
import type { Country, IntelligenceItem, Earthquake, CountryRisk } from "@/types";
import { useT } from "@/i18n";
import en from "@/locales/en.json";

export const Route = createFileRoute("/country/$name")({
  head: () => ({ meta: [{ title: en.app.pages.country.metaTitle }] }),
  component: CountryIntelligencePage,
});

/* ── Types ───────────────────────────────────────────────────────────────── */

type TimeFilter = "today" | "7d" | "30d" | "all";
type AiSection = { situation: string; riskFactors: string[]; outlook: string; focus: string };

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const TIME_FILTER_MS: Record<TimeFilter, number> = {
  today: 86_400_000,
  "7d":  7  * 86_400_000,
  "30d": 30 * 86_400_000,
  all:   Infinity,
};

function riskTierStyle(label: string) {
  if (label === "Critical") return { bar: "bg-rose-500",    text: "text-rose-400",    badge: "error"   as const };
  if (label === "High")     return { bar: "bg-amber-500",   text: "text-amber-400",   badge: "demo"    as const };
  if (label === "Medium")   return { bar: "bg-yellow-500",  text: "text-yellow-400",  badge: "neutral" as const };
  return                           { bar: "bg-emerald-500", text: "text-emerald-400", badge: "live"    as const };
}

function severityLabel(
  label: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const key = `app.ui.severity.${label.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? label : translated;
}

function timeAgo(ts: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return t("app.ui.time.justNow");
  if (ms < 3_600_000) return t("app.ui.time.minutesAgo", { count: Math.round(ms / 60_000) });
  if (ms < 86_400_000) return t("app.ui.time.hoursAgo", { count: Math.round(ms / 3_600_000) });
  return t("app.ui.time.daysAgo", { count: Math.round(ms / 86_400_000) });
}

const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from",
  "is","are","was","were","be","been","has","have","had","do","does","did","will",
  "would","could","should","may","might","not","no","as","if","it","its","that",
  "this","which","when","where","what","who","says","said","report","after","amid",
]);

function extractTopics(intel: IntelligenceItem[]): Array<{ term: string; count: number }> {
  const freq = new Map<string, number>();
  for (const item of intel) {
    const words = `${item.title} ${item.description ?? ""}`
      .replace(/[^a-zA-Z\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term: term[0].toUpperCase() + term.slice(1), count }));
}

function parseAiBriefing(content: string): AiSection {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  let situation = "", outlook = "", focus = "";
  const riskFactors: string[] = [];
  let current: "sit" | "risk" | "out" | "foc" | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes("SITUATION") || upper.includes("OVERVIEW")) { current = "sit"; continue; }
    if (upper.includes("RISK") || upper.includes("FACTOR") || upper.includes("DRIVER")) { current = "risk"; continue; }
    if (upper.includes("OUTLOOK") || upper.includes("SHORT-TERM") || upper.includes("FORECAST")) { current = "out"; continue; }
    if (upper.includes("FOCUS") || upper.includes("MONITOR") || upper.includes("RECOMMEND")) { current = "foc"; continue; }
    const clean = line.replace(/^\*+|^#+|^-\s*|^\d+\.\s*/, "").trim();
    if (!clean) continue;
    if (current === "sit") situation += (situation ? " " : "") + clean;
    else if (current === "risk") riskFactors.push(clean);
    else if (current === "out") outlook += (outlook ? " " : "") + clean;
    else if (current === "foc") focus += (focus ? " " : "") + clean;
  }
  if (!situation && lines.length) situation = lines.slice(0, 2).join(" ");
  return { situation, riskFactors, outlook, focus };
}

/* ── Page component ──────────────────────────────────────────────────────── */

function CountryIntelligencePage() {
  const t = useT();
  const { name: rawName } = Route.useParams();
  const router = useRouter();
  const countryName = decodeURIComponent(rawName);

  const [countryData, setCountryData] = useState<Country | null>(null);
  const [countryIntel, setCountryIntel] = useState<IntelligenceItem[]>([]);
  const [countryQuakes, setCountryQuakes] = useState<Earthquake[]>([]);
  const [riskData, setRiskData] = useState<CountryRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSection, setAiSection] = useState<AiSection | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [activeModal, setActiveModal] = useState<IntelligenceItem | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");
  const [countriesStatus, setCountriesStatus] = useState<CountriesStatus>("idle");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const autoGenRef = useRef(false);

  useEffect(() => {
    document.title = t("app.pages.country.metaTitle");
  }, [t]);

  useEffect(() => {
    setCountriesStatus(getCountriesStatus());
    return subscribeCountriesStatus(setCountriesStatus);
  }, []);

  /* ── Data load ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    setLoading(true);
    autoGenRef.current = false;
    setMetadataError(null);

    void (async () => {
      const country = await searchCountryByName(countryName).catch(() => null);
      const resolved = country?.[0] ?? null;

      const profile = await getCountryIntelligence(
        resolved?.name.common ?? countryName,
        resolved?.cca2,
      ).catch(() => null);

      setCountryData(resolved);
      if (!resolved) {
        setMetadataError(t("app.pages.country.metadataUnavailable", { country: countryName }));
      }

      const events = profile?.events ?? [];
      setCountryIntel(toIntelligenceItems(events));
      setCountryQuakes(toEarthquakes(events).sort((a, b) => b.magnitude - a.magnitude).slice(0, 10));
      setRiskData(
        profile ? toCountryRiskFromAssessment(resolved?.name.common ?? countryName, profile.risk) : null,
      );
      setLoading(false);
    })();
  }, [countryName, t]);

  type TlItem =
    | { kind: "intel"; item: IntelligenceItem; time: number }
    | { kind: "quake"; quake: Earthquake;      time: number };

  const allTimeline = useMemo((): TlItem[] => {
    const items: TlItem[] = [
      ...countryIntel.map((i) => ({ kind: "intel" as const, item: i, time: new Date(i.publishedAt).getTime() })),
      ...countryQuakes.map((q) => ({ kind: "quake" as const, quake: q, time: q.time })),
    ];
    return items.sort((a, b) => b.time - a.time);
  }, [countryIntel, countryQuakes]);

  const filteredTimeline = useMemo(() => {
    const cutoff = Date.now() - TIME_FILTER_MS[timeFilter];
    return allTimeline.filter((e) => e.time >= cutoff).slice(0, 30);
  }, [allTimeline, timeFilter]);

  const topics = useMemo(() => extractTopics(countryIntel), [countryIntel]);

  const severityCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of countryIntel) c[i.severity as keyof typeof c] = (c[i.severity as keyof typeof c] ?? 0) + 1;
    return c;
  }, [countryIntel]);

  const languages = countryData?.languages ? Object.values(countryData.languages).join(", ") : "—";
  const currencies = countryData?.currencies
    ? Object.values(countryData.currencies).map((c) => `${c.name}${c.symbol ? ` (${c.symbol})` : ""}`).join(", ")
    : "—";

  /* ── AI Briefing ───────────────────────────────────────────────────────── */

  const generateAI = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiSection(null);
    try {
      const displayName = countryData?.name.common ?? countryName;
      const riskInfo = riskData
        ? `Risk score: ${riskData.score}/100 (${riskData.label}). Factors: ${riskData.factors.join(", ")}.`
        : "No risk data available.";
      const topEvents = countryIntel.slice(0, 6).map((i) => `- ${i.title} [${i.severity}]`).join("\n");
      const maxQ = countryQuakes.reduce((m, q) => Math.max(m, q.magnitude), 0);

      const prompt = `Provide a structured country assessment for ${displayName}.

AVAILABLE INTELLIGENCE:
- ${riskInfo}
- Population: ${countryData?.population?.toLocaleString() ?? "Unknown"}
- Region: ${countryData?.region ?? "Unknown"}${countryData?.subregion ? `, ${countryData.subregion}` : ""}
- Intelligence events (${countryIntel.length} total):
${topEvents || "No specific country events found in the current feed."}
- Seismic activity: ${countryQuakes.length} earthquakes nearby (max M${maxQ.toFixed(1)})

Respond using EXACTLY this structure:

SITUATION:
[2-3 sentences]

RISK FACTORS:
- [factor 1]
- [factor 2]
- [factor 3 or "No additional factors"]

OUTLOOK:
[1-2 sentences]

MONITORING FOCUS:
[1 sentence]`;

      const ctx = await buildNewsContext();
      const result = await sendGlobalPulseAIChat([], prompt, ctx);
      const content = result.answer;
      if (content && result.status !== "GEMINI ERROR") {
        setAiSection(parseAiBriefing(content));
        setAiUsed(!result.localFallback);
      } else {
        setAiSection(buildLocalBriefing(displayName, countryIntel, countryQuakes, riskData));
        setAiUsed(false);
      }
    } catch {
      setAiSection(buildLocalBriefing(countryData?.name.common ?? countryName, countryIntel, countryQuakes, riskData));
      setAiUsed(false);
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, countryName, countryData, countryIntel, countryQuakes, riskData]);

  // Auto-generate when data loads
  useEffect(() => {
    if (!loading && !autoGenRef.current && (countryData !== null || countryIntel.length > 0)) {
      autoGenRef.current = true;
      void generateAI();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, countryData]);

  async function onSaveItem(item: IntelligenceItem) {
    const { isSupabaseConfigured, supabaseService } = await import("@/services/supabaseService");
    if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
    try { await supabaseService.saveIntelligence(item); toast.success(t("app.toasts.eventSavedShort")); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")); }
  }

  /* ── Loading state ─────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner label={t("app.pages.country.loading", { country: countryName })} />
      </div>
    );
  }

  const risk = riskData;
  const riskStyle = risk ? riskTierStyle(risk.label) : null;

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="page-shell space-y-5" role="main" aria-label={t("app.pages.country.ariaMain", { country: countryName })}>

      {metadataError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          {metadataError}
          {countriesStatus === "local" && t("app.pages.country.usingBundled")}
        </div>
      )}

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("app.pages.country.goBackAria")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("app.pages.country.goBack")}
      </button>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  HERO HEADER                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="glass-card relative overflow-hidden p-5 lg:p-6" aria-label={t("app.pages.country.heroAria")}>
        {/* Glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-16 -bottom-8 h-48 w-48 rounded-full bg-cyan-glow/8 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start">
          {/* Flag */}
          {countryData?.flags?.svg ? (
            <img
              src={countryData.flags.svg}
              alt={t("app.pages.country.flagAlt", { country: countryName })}
              className="h-20 w-28 rounded-lg border border-border/60 object-cover shadow-lg flex-shrink-0"
            />
          ) : (
            <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-lg border border-border/60 bg-secondary/20">
              <Globe2 className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            </div>
          )}

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {countryData?.cca2 && (
                <DataBadge variant="neutral">{countryData.cca2}</DataBadge>
              )}
              {risk && (
                <DataBadge variant={riskStyle!.badge}>
                  {t("app.pages.country.riskBadge", { label: severityLabel(risk.label, t) })}
                </DataBadge>
              )}
              <DataBadge variant="source">{t("app.pages.country.intelligenceProfile")}</DataBadge>
              {countriesStatus !== "idle" && (
                <DataBadge variant={countriesStatus === "live" ? "live" : countriesStatus === "local" ? "demo" : "neutral"}>
                  {t("app.pages.country.restStatus", { status: countriesStatus.toUpperCase() })}
                </DataBadge>
              )}
            </div>
            <h1 className="text-heading-xl tracking-tight">{countryName}</h1>
            {countryData && (
              <p className="text-body-s text-muted-foreground mt-1">
                {countryData.name.official}
                {countryData.region ? ` · ${countryData.region}` : ""}
                {countryData.subregion ? ` / ${countryData.subregion}` : ""}
              </p>
            )}

            {/* KPI chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { icon: Newspaper, label: t("app.pages.country.kpiIntelEvents"), value: countryIntel.length, color: "text-primary" },
                { icon: Activity, label: t("app.pages.country.kpiSeismic"), value: countryQuakes.length, color: "text-amber-glow" },
                { icon: AlertTriangle, label: t("app.pages.country.kpiCritical"), value: severityCounts.critical, color: "text-rose-glow" },
                { icon: Shield, label: t("app.pages.country.kpiHigh"), value: severityCounts.high, color: "text-amber-glow" },
                { icon: Users, label: t("app.pages.country.kpiPopulation"), value: countryData?.population ? `${(countryData.population / 1_000_000).toFixed(1)}M` : "—", color: "text-muted-foreground" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/50 px-2.5 py-1.5">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} aria-hidden="true" />
                  <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/map"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-1.5 text-xs text-primary hover:bg-primary/15 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.country.viewOnMap")}
              </Link>
              <Link
                to="/compare"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.country.compare")}
              </Link>
              <Link
                to="/countries"
                search={{ q: countryName }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.country.countries")}
              </Link>
              <Link
                to="/analytics"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.country.analytics")}
              </Link>
              {countryData?.maps?.googleMaps && (
                <a
                  href={countryData.maps.googleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.country.googleMaps")}
                </a>
              )}
            </div>
          </div>

          {/* Risk score badge */}
          {risk && (
            <div className="text-center flex-shrink-0 sm:ml-auto" aria-label={t("app.pages.country.riskScoreAria", { score: risk.score })}>
              <div className={`text-5xl font-bold tabular-nums ${riskStyle!.text}`}>{risk.score}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t("app.pages.country.riskScore")}</div>
              <div className="text-[9px] text-muted-foreground/60">{t("app.pages.country.outOf100")}</div>
              <div
                className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-secondary/40"
                role="progressbar"
                aria-valuenow={risk.score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={`h-full ${riskStyle!.bar} transition-all duration-700`} style={{ width: `${risk.score}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  MAIN GRID                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── LEFT COLUMN (2/3) ─────────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* AI COUNTRY BRIEFING */}
          <div className="glass-card p-4" aria-label={t("app.pages.country.aiBriefing.title")}>
            <SectionHeader
              title={t("app.pages.country.aiBriefing.title")}
              subtitle={aiUsed ? t("app.pages.country.aiBriefing.subtitleLive") : t("app.pages.country.aiBriefing.subtitleLocal")}
              right={
                <div className="flex items-center gap-2">
                  {aiUsed ? <DataBadge variant="live">{t("app.pages.country.aiBriefing.aiLive")}</DataBadge> : <DataBadge variant="neutral">{t("app.pages.country.aiBriefing.local")}</DataBadge>}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void generateAI()}
                    disabled={aiLoading}
                    aria-label={t("app.pages.country.aiBriefing.regenerate")}
                    title={t("app.pages.country.aiBriefing.regenerateTitle")}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              }
              size="sm"
            />

            {aiLoading && !aiSection ? (
              <div className="mt-3 space-y-3">
                {[85, 70, 90, 60].map((w, i) => <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />)}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Brain className="h-3.5 w-3.5 animate-pulse text-primary" aria-hidden="true" />
                  <span>{t("app.pages.country.aiBriefing.analyzing", { country: countryName })}</span>
                </div>
              </div>
            ) : aiSection ? (
              <div className="mt-3 space-y-3 animate-fade-in">
                {aiSection.situation && (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                      <span className="text-label text-primary">{t("app.pages.country.aiBriefing.situation")}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">{aiSection.situation}</p>
                  </div>
                )}
                {aiSection.riskFactors.length > 0 && (
                  <div className="rounded-lg border border-rose-500/15 bg-rose-500/5 p-3">
                    <div className="text-label text-rose-400 mb-1.5">{t("app.pages.country.aiBriefing.riskFactors")}</div>
                    <ul className="space-y-1" role="list">
                      {aiSection.riskFactors.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                          <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-rose-400/60" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {aiSection.outlook && (
                    <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                      <div className="text-label text-amber-400 mb-1.5">{t("app.pages.country.aiBriefing.outlook")}</div>
                      <p className="text-xs text-foreground/80 leading-snug">{aiSection.outlook}</p>
                    </div>
                  )}
                  {aiSection.focus && (
                    <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3">
                      <div className="text-label text-cyan-400 mb-1.5">{t("app.pages.country.aiBriefing.monitor")}</div>
                      <p className="text-xs text-foreground/80 leading-snug">{aiSection.focus}</p>
                    </div>
                  )}
                </div>
                {aiLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                    <Brain className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {t("app.pages.country.aiBriefing.updating")}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Brain className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
                {t("app.pages.country.aiBriefing.loadingData")}
              </div>
            )}

            <div className="mt-3 border-t border-border/30 pt-3">
              <Link
                to="/ai-news"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                {t("app.pages.country.aiBriefing.deepDive")}
              </Link>
            </div>
          </div>

          {/* INTELLIGENCE TIMELINE */}
          <div className="glass-card p-4" aria-label={t("app.pages.country.timeline.title")}>
            <SectionHeader
              title={t("app.pages.country.timeline.title")}
              subtitle={
                timeFilter !== "all"
                  ? t("app.pages.country.timeline.subtitleFiltered", {
                      count: filteredTimeline.length,
                      period: timeFilter === "today"
                        ? t("app.pages.country.timeline.today")
                        : timeFilter === "7d"
                          ? t("app.pages.country.timeline.days7")
                          : t("app.pages.country.timeline.days30"),
                    })
                  : t("app.pages.country.timeline.subtitle", { count: filteredTimeline.length })
              }
              right={<Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              size="sm"
            />

            {/* Filter tabs */}
            <div className="mt-3 flex gap-1.5 flex-wrap" role="tablist" aria-label={t("app.pages.country.timeline.filterAria")}>
              {([
                { id: "today" as const, label: t("app.pages.country.timeline.today") },
                { id: "7d" as const, label: t("app.pages.country.timeline.days7") },
                { id: "30d" as const, label: t("app.pages.country.timeline.days30") },
                { id: "all" as const, label: t("app.pages.country.timeline.all") },
              ]).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={timeFilter === f.id}
                  onClick={() => setTimeFilter(f.id)}
                  className={[
                    "rounded-lg border px-3 py-1 text-[11px] font-medium transition-colors",
                    timeFilter === f.id
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredTimeline.length === 0 ? (
              <EmptyState
                title={t("app.pages.country.timeline.emptyTitle")}
                hint={t("app.pages.country.timeline.emptyHint", { count: allTimeline.length })}
                compact
              />
            ) : (
              <div
                className="mt-4 panel-scroll space-y-0"
                role="feed"
                aria-label={t("app.pages.country.timeline.eventsAria")}
              >
                {filteredTimeline.map((entry, idx) => (
                  <div key={idx} className="flex gap-3">
                    {/* Vertical line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={[
                          "mt-1 h-3 w-3 rounded-full border-2 flex-shrink-0",
                          entry.kind === "quake"
                            ? "border-amber-400 bg-amber-400/30"
                            : entry.kind === "intel" && entry.item.severity === "critical"
                            ? "border-rose-400 bg-rose-400/30"
                            : entry.kind === "intel" && entry.item.severity === "high"
                            ? "border-amber-400 bg-amber-400/25"
                            : "border-primary bg-primary/25",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      {idx < filteredTimeline.length - 1 && (
                        <div className="w-px flex-1 bg-border/30 my-1" aria-hidden="true" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-4 min-w-0 flex-1 ${idx === filteredTimeline.length - 1 ? "pb-0" : ""}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(entry.time, t)}</span>
                        {entry.kind === "intel" && (
                          <span className={`text-[9px] font-semibold uppercase px-1 rounded ${
                            entry.item.severity === "critical" ? "text-rose-400 bg-rose-500/10" :
                            entry.item.severity === "high"     ? "text-amber-400 bg-amber-500/10" :
                            "text-muted-foreground bg-secondary/30"
                          }`}>{severityLabel(entry.item.severity, t)}</span>
                        )}
                        {entry.kind === "quake" && (
                          <span className="text-[9px] font-semibold uppercase text-amber-400 bg-amber-500/10 px-1 rounded">M{entry.quake.magnitude.toFixed(1)}</span>
                        )}
                      </div>
                      {entry.kind === "intel" ? (
                        <button
                          type="button"
                          onClick={() => setActiveModal(entry.item)}
                          className="text-left text-xs font-medium hover:text-primary transition-colors line-clamp-2 w-full"
                          aria-label={t("app.pages.country.timeline.viewDetails", { title: entry.item.title })}
                        >
                          {entry.item.title}
                        </button>
                      ) : (
                        <p className="text-xs font-medium text-amber-300/90 line-clamp-2">
                          {t("app.pages.country.timeline.earthquake", {
                            mag: entry.quake.magnitude.toFixed(1),
                            place: entry.quake.place,
                          })}
                        </p>
                      )}
                      {entry.kind === "intel" && (
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">{entry.item.source} · {entry.item.category}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECENT INTELLIGENCE */}
          <div className="glass-card p-4">
            <SectionHeader
              title={t("app.pages.country.recentIntel.title")}
              subtitle={t("app.pages.country.recentIntel.subtitle", { count: countryIntel.length })}
              right={<Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              size="sm"
            />
            {countryIntel.length === 0 ? (
              <EmptyState
                title={t("app.pages.country.recentIntel.emptyTitle")}
                hint={t("app.pages.country.recentIntel.emptyHint")}
              />
            ) : (
              <div className="mt-3 space-y-2">
                {countryIntel.slice(0, 10).map((item) => (
                  <IntelEventRow key={item.id} item={item} onOpen={setActiveModal} />
                ))}
                {countryIntel.length > 10 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    {t("app.pages.country.recentIntel.moreEvents", { count: countryIntel.length - 10 })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SEISMIC ACTIVITY */}
          {countryQuakes.length > 0 && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.country.seismic.title")}
                subtitle={t("app.pages.country.seismic.subtitle", { count: countryQuakes.length, country: countryName })}
                right={<Activity className="h-4 w-4 text-amber-400" aria-hidden="true" />}
                size="sm"
              />
              <div className="mt-3 space-y-2">
                {countryQuakes.map((q) => {
                  const magColor = q.magnitude >= 6 ? "text-rose-400 bg-rose-500/15 border-rose-500/30"
                    : q.magnitude >= 5 ? "text-amber-400 bg-amber-500/15 border-amber-500/30"
                    : "text-yellow-400 bg-yellow-500/10 border-yellow-500/25";
                  return (
                    <div key={q.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/15 p-2.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-bold text-sm ${magColor}`}>
                        {q.magnitude.toFixed(1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{q.place}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {t("app.pages.country.seismic.depth", { depth: q.depth.toFixed(1), time: timeAgo(q.time, t) })}
                        </div>
                      </div>
                      {q.url && (
                        <a
                          href={q.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-border/50 p-1 text-muted-foreground hover:text-primary transition-colors"
                          aria-label={t("app.pages.country.seismic.viewUsgs")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              <Link
                to="/earthquakes"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full"
              >
                {t("app.pages.country.seismic.fullDatabase")}
              </Link>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN (1/3) ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* GEOGRAPHIC PROFILE */}
          {countryData && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.country.geoProfile.title")}
                right={<Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                size="sm"
              />
              <div className="mt-3 space-y-2">
                <InfoRow icon={MapPin}      label={t("app.pages.country.geoProfile.capital")}     value={countryData.capital?.[0] ?? "—"} />
                <InfoRow icon={Globe2}      label={t("app.pages.country.geoProfile.region")}      value={`${countryData.region}${countryData.subregion ? ` / ${countryData.subregion}` : ""}`} />
                <InfoRow icon={Users}       label={t("app.pages.country.geoProfile.population")}  value={countryData.population?.toLocaleString() ?? "—"} />
                <InfoRow icon={TrendingUp}  label={t("app.pages.country.geoProfile.area")}        value={countryData.area ? t("app.pages.country.geoProfile.areaValue", { area: countryData.area.toLocaleString() }) : "—"} />
                {countryData.languages && <InfoRow icon={Newspaper}   label={t("app.pages.country.geoProfile.languages")}  value={languages} />}
                {countryData.currencies && <InfoRow icon={TrendingUp}  label={t("app.pages.country.geoProfile.currency")}   value={currencies} />}
                {countryData.timezones?.length && <InfoRow icon={Clock} label={t("app.pages.country.geoProfile.timezone")} value={countryData.timezones[0]} />}
              </div>
            </div>
          )}

          {/* RISK ASSESSMENT */}
          {risk && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.country.riskAssessment.title")}
                right={<AlertTriangle className={`h-4 w-4 ${riskStyle!.text}`} aria-hidden="true" />}
                size="sm"
              />
              <div className="mt-3 space-y-3">
                {/* Score */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{t("app.pages.country.riskAssessment.compositeScore")}</span>
                  <span className={`text-3xl font-bold tabular-nums ${riskStyle!.text}`}>{risk.score}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40" role="progressbar" aria-valuenow={risk.score} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full transition-all duration-700 ${riskStyle!.bar}`} style={{ width: `${risk.score}%` }} />
                </div>

                {/* Severity distribution */}
                {countryIntel.length > 0 && (
                  <div className="pt-1">
                    <div className="text-label text-muted-foreground mb-2">{t("app.pages.country.riskAssessment.eventDistribution")}</div>
                    <div className="space-y-1.5">
                      {([
                        { label: t("app.ui.severity.critical"), key: "critical", color: "bg-rose-500",    text: "text-rose-400" },
                        { label: t("app.ui.severity.high"),     key: "high",     color: "bg-amber-500",   text: "text-amber-400" },
                        { label: t("app.ui.severity.medium"),   key: "medium",   color: "bg-yellow-500",  text: "text-yellow-400" },
                        { label: t("app.ui.severity.low"),      key: "low",      color: "bg-emerald-500", text: "text-emerald-400" },
                      ] as const).map(({ label, key, color, text }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`w-14 text-[10px] text-right flex-shrink-0 ${text}`}>{label}</span>
                          <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all duration-500`}
                              style={{ width: countryIntel.length > 0 ? `${(severityCounts[key] / countryIntel.length) * 100}%` : "0%" }}
                              aria-hidden="true"
                            />
                          </div>
                          <span className="w-5 text-[10px] tabular-nums text-right text-muted-foreground">{severityCounts[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active factors */}
                {risk.factors.length > 0 && (
                  <div>
                    <div className="text-label text-muted-foreground mb-1.5">{t("app.pages.country.riskAssessment.activeFactors")}</div>
                    <div className="flex flex-wrap gap-1">
                      {risk.factors.map((f) => (
                        <span key={f} className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRENDING TOPICS */}
          {topics.length > 0 && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.country.trending.title")}
                subtitle={t("app.pages.country.trending.subtitle")}
                right={<Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                size="sm"
              />
              <ol className="mt-3 space-y-2" aria-label={t("app.pages.country.trending.aria")}>
                {topics.map((topic, i) => (
                  <li key={topic.term} className="flex items-center gap-2">
                    <span className="w-4 text-[10px] font-bold text-muted-foreground/50 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{topic.term}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums ml-2">{topic.count}×</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/40">
                        <div
                          className="h-full rounded-full bg-primary/50 transition-all duration-500"
                          style={{ width: `${(topic.count / (topics[0]?.count ?? 1)) * 100}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* RELATED COUNTRIES */}
          {countryData?.borders && countryData.borders.length > 0 && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.country.borders.title")}
                subtitle={t("app.pages.country.borders.subtitle")}
                right={<Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                size="sm"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {countryData.borders.map((code) => (
                  <Link
                    key={code}
                    to="/countries"
                    search={{ q: code }}
                    className="rounded-lg border border-border/50 bg-secondary/15 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    aria-label={t("app.pages.country.borders.viewAria", { code })}
                  >
                    {code}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* QUICK INTELLIGENCE SNAPSHOT */}
          <div className="glass-card p-4">
            <SectionHeader title={t("app.pages.country.snapshot.title")} size="sm" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SnapStat label={t("app.pages.country.snapshot.intelEvents")}  value={countryIntel.length}                             color="text-primary" />
              <SnapStat label={t("app.pages.country.snapshot.seismic24h")} value={countryQuakes.length}                            color="text-amber-400" />
              <SnapStat label={t("app.pages.country.snapshot.critical")}      value={severityCounts.critical}                         color="text-rose-400" />
              <SnapStat label={t("app.pages.country.snapshot.highPriority")} value={severityCounts.high}                             color="text-amber-400" />
            </div>
            <div className="mt-3">
              <Link
                to="/intelligence"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full"
              >
                {t("app.pages.country.snapshot.fullFeed")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <IntelligenceDetailsModal
        item={activeModal}
        onClose={() => setActiveModal(null)}
        onSave={onSaveItem}
      />
    </div>
  );
}

/* ── Local AI fallback ───────────────────────────────────────────────────── */

function buildLocalBriefing(
  country: string,
  intel: IntelligenceItem[],
  quakes: Earthquake[],
  risk: CountryRisk | null,
): AiSection {
  const critical = intel.filter((i) => i.severity === "critical");
  const high = intel.filter((i) => i.severity === "high");
  const maxQ = quakes.reduce((m, q) => Math.max(m, q.magnitude), 0);

  const situation = critical.length > 0
    ? `${country} currently has ${critical.length} critical intelligence events active, alongside ${high.length} high-priority reports. The situation requires close monitoring.`
    : high.length > 0
    ? `${country} shows ${high.length} high-priority events in the current intelligence feed. The situation is elevated but not critical.`
    : `No critical or high-priority events are currently recorded for ${country}. The intelligence picture appears stable based on available data.`;

  const riskFactors: string[] = [];
  if (critical.length > 0) riskFactors.push(`${critical.length} critical intelligence events active`);
  if (quakes.length > 0) riskFactors.push(`${quakes.length} seismic events in the region (max M${maxQ.toFixed(1)})`);
  if (risk?.factors?.length) riskFactors.push(...risk.factors.slice(0, 2));
  if (riskFactors.length === 0) riskFactors.push("No significant risk factors identified in current data");

  const outlook = risk && risk.score > 60
    ? `Elevated risk environment persists. Monitor for escalation of ${critical[0]?.category ?? "active"} sector events.`
    : `Situation appears manageable. Continue standard monitoring protocols and update assessment as new intelligence arrives.`;

  const focus = `${intel[0]?.category ?? "General"} sector events and regional seismic activity.`;

  return { situation, riskFactors, outlook, focus };
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function IntelEventRow({
  item,
  onOpen,
}: {
  item: IntelligenceItem;
  onOpen: (item: IntelligenceItem) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/15 p-2.5 transition-colors hover:border-border/60">
      <SeverityBadge severity={item.severity} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="text-left w-full"
          aria-label={t("app.pages.country.viewItem", { title: item.title })}
        >
          <div className="line-clamp-2 text-xs font-medium hover:text-primary transition-colors">{item.title}</div>
        </button>
        <div suppressHydrationWarning className="mt-0.5 text-[10px] text-muted-foreground">
          {item.source} · {item.category} · {new Date(item.publishedAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onOpen(item)}
          title={t("app.pages.country.viewDetails")}
          className="rounded border border-border/50 p-1 text-muted-foreground hover:text-primary transition-colors"
          aria-label={t("app.pages.country.viewDetails")}
        >
          <Eye className="h-3 w-3" />
        </button>
        <Link
          to="/event/$id"
          params={{ id: encodeURIComponent(item.id) }}
          className="rounded border border-primary/40 bg-primary/10 px-1.5 py-1 text-[9px] text-primary hover:bg-primary/20 transition-colors"
          aria-label={t("app.pages.country.fullAnalysis")}
        >
          {t("app.pages.country.fullAnalysis")}
        </Link>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-border/25 pb-2 last:border-0">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs font-medium">{value}</div>
      </div>
    </div>
  );
}

function SnapStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-2.5 text-center">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
