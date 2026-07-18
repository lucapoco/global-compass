/**
 * ExecutiveReportPanel — GP-011: AI Executive Reports.
 *
 * Generates professional intelligence briefings from live platform data.
 * Supports 10 report types, each with a tailored AI prompt and data subset.
 *
 * Architecture decisions:
 *  1. Calls /api/ai-news-chat directly — simpler than /api/generate-report
 *     and avoids touching the existing reportService.ts (which has pre-existing errors).
 *  2. Data is fetched fresh per generation (uses the same 30-min cache as other pages).
 *  3. The report is rendered inline with export options (GP-014 integration).
 *  4. Each report type defines: name, description, data filters, and AI prompt template.
 */
import { useCallback, useMemo, useState } from "react";
import {
  FileText, Sun, Moon, Calendar, Globe2, Shield, TrendingUp,
  Cloud, Cpu, BookOpen, RefreshCw, Download, Printer,
  ChevronDown, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { exportToPDF, exportToJSON, exportReportToTXT } from "@/utils/exportIntelligence";
// Centralized Intelligence Store — reports now draw on every active
// provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS,
// World Bank, ...), not just GNews + USGS.
import { getLatestEvents, getHighestRiskCountries } from "@/domain/store";
import { toIntelligenceItems, toEarthquakes, toCountryRisks } from "@/domain/adapters/legacyIntelAdapter";
import type { IntelligenceItem, Earthquake, CountryRisk } from "@/types";
import { useT } from "@/i18n";

// ─── Report type config ───────────────────────────────────────────────────────

interface ReportType {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  requiresCountry?: boolean;
  categoryFilter?: string[];
  badge?: string;
}

const REPORT_TYPE_META: Array<{
  id: string;
  icon: React.ElementType;
  requiresCountry?: boolean;
  categoryFilter?: string[];
  hasBadge?: boolean;
}> = [
  { id: "morning", icon: Sun, hasBadge: true },
  { id: "evening", icon: Moon, hasBadge: true },
  { id: "daily", icon: Calendar },
  { id: "weekly", icon: BookOpen },
  { id: "country", icon: Globe2, requiresCountry: true },
  { id: "conflict", icon: Shield, categoryFilter: ["military", "politics", "geopolitics"] },
  { id: "economic", icon: TrendingUp, categoryFilter: ["economy", "energy"] },
  { id: "climate", icon: Cloud, categoryFilter: ["climate", "disaster", "weather"] },
  { id: "cyber", icon: Cpu, categoryFilter: ["cyber", "technology"] },
  { id: "technology", icon: Cpu, categoryFilter: ["technology", "cyber"] },
];

// ─── AI prompt builders ───────────────────────────────────────────────────────

function buildPrompt(
  type: ReportType,
  events: IntelligenceItem[],
  quakes: Earthquake[],
  risks: CountryRisk[],
  country?: string,
): string {
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const topEvents = events.slice(0, 12).map((e) => `- [${e.severity.toUpperCase()}] ${e.title} (${e.source}, ${e.country ?? "Global"})`).join("\n");
  const topRisks = risks.slice(0, 5).map((r) => `- ${r.country}: ${r.score}/100 (${r.label})`).join("\n");
  const majorQuakes = quakes.filter((q) => q.magnitude >= 5).slice(0, 5).map((q) => `- M${q.magnitude.toFixed(1)} ${q.place}`).join("\n");

  const baseContext = `
AVAILABLE INTELLIGENCE DATA (${date}):

Events (${events.length} total):
${topEvents || "None"}

Country Risk Index:
${topRisks || "None"}

Significant Earthquakes:
${majorQuakes || "None"}
  `.trim();

  const prompts: Record<string, string> = {
    morning: `You are the Global Pulse intelligence platform. Generate a professional MORNING BRIEFING for ${date}.

${baseContext}

Format as an executive briefing memo with these sections:
## EXECUTIVE SUMMARY
(3-4 sentences capturing the overnight intelligence picture)

## PRIORITY INTELLIGENCE
(Top 5 most important developments with brief explanation of why each matters)

## THREAT ASSESSMENT
(Current global threat level and primary risk drivers)

## SECTORS TO MONITOR
(Key domains requiring heightened attention today)

## CONCLUSION
(One-sentence operational summary)

Use professional intelligence analysis language. Explain WHY each event is significant.`,

    evening: `You are the Global Pulse intelligence platform. Generate a professional EVENING BRIEFING for ${date}.

${baseContext}

Format as an end-of-day intelligence memo with:
## DAY REVIEW
(How the day's intelligence picture developed)

## KEY DEVELOPMENTS
(Most significant events from today's feed)

## RISK EVOLUTION
(How the global risk picture changed during the day)

## OVERNIGHT WATCH
(Events and situations to monitor overnight)

## TOMORROW'S OUTLOOK
(Areas likely to develop based on current data)

Professional analytical tone throughout. Explain significance of each point.`,

    daily: `You are the Global Pulse intelligence platform. Generate a DAILY INTELLIGENCE SUMMARY for ${date}.

${baseContext}

Format as a comprehensive daily digest:
## SITUATION OVERVIEW
(Comprehensive 24-hour picture)

## CRITICAL EVENTS
(All critical and high-severity events with analysis)

## REGIONAL ANALYSIS
(By geographic region: Europe, Asia-Pacific, Americas, Middle East, Africa)

## SECTOR BREAKDOWN
(Military/Political, Economic, Cyber, Environmental, Health)

## RISK MATRIX
(Countries at elevated risk with scores and factors)

## SEISMIC ACTIVITY
(Notable earthquake activity)

## INTELLIGENCE ASSESSMENT
(Analytical conclusion and forward indicators)`,

    weekly: `You are the Global Pulse intelligence platform. Generate a STRATEGIC WEEKLY SUMMARY based on current intelligence.

${baseContext}

Note: This summary is based on the current intelligence snapshot, not a full week of historical data.

Format:
## STRATEGIC OVERVIEW
(High-level picture of the current global situation)

## DOMINANT THEMES
(2-3 major themes shaping the current intelligence environment)

## COUNTRY SPOTLIGHT
(Top 3 countries by risk with detailed assessment)

## SECTOR ANALYSIS
(One paragraph per major sector)

## RISK INDICATORS
(Key metrics and what they suggest)

## STRATEGIC CONCLUSION
(Long-term implications of current trends)`,

    country: `You are the Global Pulse intelligence platform. Generate a COUNTRY INTELLIGENCE REPORT for ${country ?? "Unknown"}.

${baseContext}

Focus specifically on ${country}-related intelligence:
${events.filter((e) => e.country?.toLowerCase() === country?.toLowerCase()).slice(0, 8).map((e) => `- [${e.severity.toUpperCase()}] ${e.title}`).join("\n") || "No specific events found"}

Format:
## COUNTRY PROFILE: ${country?.toUpperCase()}
## CURRENT SITUATION
## SECURITY ASSESSMENT
## ECONOMIC INDICATORS
## POLITICAL LANDSCAPE
## RECENT INCIDENTS
## RISK ASSESSMENT
## INTELLIGENCE CONCLUSION

Be specific to ${country}. Explain why each development matters for this country.`,

    conflict: `You are the Global Pulse intelligence platform. Generate a CONFLICT INTELLIGENCE REPORT for ${date}.

Military/Geopolitical events:
${topEvents}

Country Risk:
${topRisks}

Format:
## CONFLICT SITUATION REPORT
## ACTIVE CONFLICT ZONES
## MILITARY DEVELOPMENTS
## DIPLOMATIC INTELLIGENCE
## ESCALATION INDICATORS
## STABILITY ASSESSMENT
## OPERATIONAL CONCLUSION

Focus exclusively on military, geopolitical, and conflict-related intelligence.`,

    economic: `You are the Global Pulse intelligence platform. Generate an ECONOMIC INTELLIGENCE REPORT for ${date}.

Economic events:
${topEvents}

${baseContext}

Format:
## ECONOMIC INTELLIGENCE BRIEFING
## MARKET SIGNALS
## TRADE AND ENERGY
## SANCTIONS AND RESTRICTIONS
## FINANCIAL RISK
## COUNTRY ECONOMIC PROFILES
## ECONOMIC OUTLOOK

Focus on economic, energy, trade, and financial intelligence.`,

    climate: `You are the Global Pulse intelligence platform. Generate a CLIMATE AND ENVIRONMENTAL INTELLIGENCE REPORT for ${date}.

${baseContext}

Format:
## ENVIRONMENTAL INTELLIGENCE BRIEFING
## NATURAL DISASTERS
## CLIMATE EVENTS
## HUMANITARIAN IMPACT
## SEISMIC ACTIVITY (${quakes.filter((q) => q.magnitude >= 5).length} significant earthquakes)
## REGIONAL ENVIRONMENTAL ASSESSMENT
## CONCLUSION

Include all earthquake data: ${majorQuakes || "No major seismic events"}`,

    cyber: `You are the Global Pulse intelligence platform. Generate a CYBER INTELLIGENCE REPORT for ${date}.

${baseContext}

Format:
## CYBER THREAT BRIEFING
## ACTIVE THREATS
## CRITICAL INFRASTRUCTURE
## NATION-STATE ACTIVITY
## VULNERABILITY ASSESSMENT
## DEFENSIVE RECOMMENDATIONS
## THREAT OUTLOOK

Focus on cybersecurity, digital threats, and technology vulnerabilities.`,

    technology: `You are the Global Pulse intelligence platform. Generate a TECHNOLOGY INTELLIGENCE REPORT for ${date}.

${baseContext}

Format:
## TECHNOLOGY INTELLIGENCE BRIEFING
## DIGITAL DEVELOPMENTS
## AI AND EMERGING TECHNOLOGIES
## REGULATORY LANDSCAPE
## CYBERSECURITY INTERSECTIONS
## TECHNOLOGY RISK ASSESSMENT
## CONCLUSION

Focus on technology sector developments, digital economy, and innovation intelligence.`,
  };

  return prompts[type.id] ?? prompts.daily;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GeneratedReport {
  type: string;
  title: string;
  content: string;
  generatedAt: Date;
  events: IntelligenceItem[];
  quakes: Earthquake[];
  risks: CountryRisk[];
  country?: string;
}

export function ExecutiveReportPanel() {
  const t = useT();

  const reportTypes = useMemo((): ReportType[] => {
    return REPORT_TYPE_META.map((meta) => ({
      ...meta,
      label: t(`app.pages.reports.types.${meta.id}.label`),
      description: t(`app.pages.reports.types.${meta.id}.description`),
      badge: meta.hasBadge ? t(`app.pages.reports.types.${meta.id}.badge`) : undefined,
    }));
  }, [t]);

  const [selectedTypeId, setSelectedTypeId] = useState(REPORT_TYPE_META[0]!.id);
  const selectedType = reportTypes.find((rt) => rt.id === selectedTypeId) ?? reportTypes[0]!;
  const [country, setCountry] = useState("");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const generate = useCallback(async () => {
    if (selectedType.requiresCountry && !country.trim()) {
      toast.error(t("app.toasts.reportCountryRequired"));
      return;
    }
    setGenerating(true);
    setReport(null);
    try {
      // Single shared load from the centralized Intelligence Store — spans
      // every active provider, not just GNews + USGS.
      const [allEvents, topRiskCountries] = await Promise.all([
        getLatestEvents({ limit: 200 }),
        getHighestRiskCountries(10),
      ]);
      const newsStatus = allEvents.some((e) => e.live) ? "live" : allEvents.length > 0 ? "cached" : "demo";

      let events = toIntelligenceItems(allEvents);
      const quakes = toEarthquakes(allEvents);
      // Apply category filter if defined
      if (selectedType.categoryFilter?.length) {
        const filtered = events.filter((e) =>
          selectedType.categoryFilter!.some((cat) => e.category?.toLowerCase().includes(cat)),
        );
        // Fall back to all events if filtered is too sparse
        events = filtered.length >= 3 ? filtered : events;
      }

      // Filter by country for country reports
      if (selectedType.id === "country" && country.trim()) {
        const countryFiltered = events.filter((e) =>
          e.country?.toLowerCase().includes(country.toLowerCase()),
        );
        if (countryFiltered.length > 0) events = countryFiltered;
      }

      const risks = toCountryRisks(topRiskCountries);
      const prompt = buildPrompt(selectedType, events, quakes, risks, country.trim() || undefined);
      const reportTitle = t("app.pages.reports.executive.reportTitle", {
        label: selectedType.label,
        date: new Date().toLocaleDateString(),
      });

      // Call Gemini via the existing ai-news-chat endpoint
      const res = await fetch("/api/ai-news-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: {
            dataStatus: { news: newsStatus, earthquakes: "live", supabase: "na", overall: newsStatus },
            newsSource: "Global Pulse Intelligence Engine",
            lastUpdated: new Date().toISOString(),
            intelligenceItems: events.slice(0, 10),
            criticalAlerts: [],
            earthquakes: quakes.slice(0, 5),
            countryRisks: risks.slice(0, 5),
            savedDataSummary: { intelligenceCount: 0, alertsCount: 0, countriesCount: 0 },
            apiHealth: { gnews: "live", usgs: "live", supabase: "na", openWeather: "na", map: "na" },
          },
        }),
      });

      const data = (await res.json()) as { answer?: string; fallbackAnswer?: string; error?: string };

      if (data.error && !data.answer && !data.fallbackAnswer) {
        // Gemini not configured — build local structured report
        const localContent = buildLocalReport(selectedType, events, quakes, risks, country);
        setReport({ type: selectedType.id, title: reportTitle, content: localContent, generatedAt: new Date(), events, quakes, risks, country: country || undefined });
        toast.message(t("app.toasts.reportAiFallback"));
      } else {
        const content = data.answer ?? data.fallbackAnswer ?? "Report content unavailable.";
        setReport({ type: selectedType.id, title: reportTitle, content, generatedAt: new Date(), events, quakes, risks, country: country || undefined });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.reportGenerationFailed"));
    } finally {
      setGenerating(false);
    }
  }, [selectedType, country, t]);

  const handleExportPDF = useCallback(() => {
    if (!report) return;
    exportToPDF({
      title: report.title,
      type: report.type,
      content: report.content,
      events: report.events,
      risks: report.risks,
      quakes: report.quakes,
    });
  }, [report]);

  const handleExportJSON = useCallback(() => {
    if (!report) return;
    exportToJSON({
      exportedAt: report.generatedAt.toISOString(),
      exportedBy: "Global Pulse Intelligence Platform",
      version: "1.0",
      report: { title: report.title, type: report.type, content: report.content },
      events: report.events,
      earthquakes: report.quakes,
      countryRisks: report.risks,
    }, `report-${report.type}-${new Date().toISOString().slice(0, 10)}.json`);
  }, [report]);

  const handleExportTXT = useCallback(() => {
    if (!report) return;
    exportReportToTXT(report.title, report.content);
  }, [report]);

  const TypeIcon = selectedType.icon;

  // Render markdown-like content
  const renderedContent = useMemo(() => {
    if (!report) return null;
    return report.content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h3 key={i} className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wider text-primary border-b border-border/30 pb-1">{line.slice(3)}</h3>;
      if (line.startsWith("# ")) return <h2 key={i} className="mt-2 mb-3 text-base font-bold">{line.slice(2)}</h2>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <li key={i} className="ml-4 text-sm text-muted-foreground">{line.slice(2)}</li>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-semibold mt-2">{line.slice(2, -2)}</p>;
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
    });
  }, [report]);

  return (
    <div className="space-y-4">
      {/* ── Type selector ─────────────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <SectionHeader
          title={t("app.pages.reports.executive.title")}
          subtitle={t("app.pages.reports.executive.subtitle")}
          right={<Brain className="h-4 w-4 text-primary" />}
        />

        {/* Report type dropdown */}
        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setShowTypeDropdown((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-left hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <TypeIcon className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">{selectedType.label}</div>
                <div className="text-[11px] text-muted-foreground">{selectedType.description}</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showTypeDropdown ? "rotate-180" : ""}`} />
          </button>

          {showTypeDropdown && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-border/60 bg-card shadow-xl">
              <div className="max-h-72 overflow-y-auto p-1">
                {reportTypes.map((rt) => {
                  const RIcon = rt.icon;
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => { setSelectedTypeId(rt.id); setShowTypeDropdown(false); }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 ${
                        selectedType.id === rt.id ? "bg-primary/10 text-primary" : ""
                      }`}
                    >
                      <RIcon className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {rt.label}
                          {rt.badge && <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">{rt.badge}</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{rt.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Country input for country reports */}
        {selectedType.requiresCountry && (
          <div className="mt-3">
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void generate(); }}
              placeholder={t("app.pages.reports.executive.countryPlaceholder")}
              className="w-full rounded-xl border border-border/60 bg-background/40 px-4 py-2.5 text-sm outline-none focus:border-primary/60"
            />
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button onClick={() => void generate()} disabled={generating} className="gap-2">
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {generating ? t("app.pages.reports.executive.generating") : t("app.pages.reports.executive.generate")}
          </Button>
          {report && (
            <DataBadge variant="live">{t("app.pages.reports.executive.reportReady")}</DataBadge>
          )}
        </div>
      </div>

      {/* ── Report preview ─────────────────────────────────────────────────── */}
      {generating && (
        <div className="glass-card p-8 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">{t("app.pages.reports.executive.generatingLabel", { label: selectedType.label })}</div>
            <div className="text-xs text-muted-foreground mt-1">{t("app.pages.reports.executive.generatingHint")}</div>
          </div>
        </div>
      )}

      {!generating && !report && (
        <div className="glass-card p-6">
          <EmptyState
            title={t("app.pages.reports.executive.emptyTitle")}
            hint={t("app.pages.reports.executive.emptyHint")}
          />
        </div>
      )}

      {!generating && report && (
        <div className="glass-card p-5">
          {/* Report header */}
          <div className="mb-4 border-b border-border/40 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{report.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <DataBadge variant="source">{report.type}</DataBadge>
                  <span suppressHydrationWarning>{t("app.pages.reports.executive.generatedAt", { time: report.generatedAt.toLocaleTimeString() })}</span>
                  <span>·</span>
                  <span>{t("app.pages.reports.executive.eventsUsed", { count: report.events.length })}</span>
                </div>
              </div>
              {/* Export buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  title={t("app.pages.reports.executive.exportPdf")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
                >
                  <Printer className="h-3.5 w-3.5" /> {t("app.pages.reports.executive.pdf")}
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  title={t("app.pages.reports.executive.exportJson")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
                >
                  <Download className="h-3.5 w-3.5" /> {t("app.pages.reports.executive.json")}
                </button>
                <button
                  type="button"
                  onClick={handleExportTXT}
                  title={t("app.pages.reports.executive.exportTxt")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
                >
                  <FileText className="h-3.5 w-3.5" /> {t("app.pages.reports.executive.txt")}
                </button>
              </div>
            </div>
          </div>

          {/* Report content */}
          <div className="prose-sm max-w-none space-y-0">
            {renderedContent}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Local fallback report (no Gemini) ───────────────────────────────────────

function buildLocalReport(
  type: ReportType,
  events: IntelligenceItem[],
  quakes: Earthquake[],
  risks: CountryRisk[],
  country?: string,
): string {
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const critical = events.filter((e) => e.severity === "critical");
  const high = events.filter((e) => e.severity === "high");
  const majorQuakes = quakes.filter((q) => q.magnitude >= 5);

  const lines: string[] = [
    `## ${type.label.toUpperCase()}`,
    `Date: ${date}`,
    ``,
    `## EXECUTIVE SUMMARY`,
    `Global Pulse has detected ${events.length} active intelligence events. ${critical.length} are classified as critical severity and ${high.length} as high priority.`,
    ``,
    `## PRIORITY INTELLIGENCE`,
    ...critical.slice(0, 5).map((e) => `- [CRITICAL] ${e.title} (${e.source}${e.country ? ", " + e.country : ""})`),
    ...high.slice(0, 3).map((e) => `- [HIGH] ${e.title} (${e.source}${e.country ? ", " + e.country : ""})`),
    ``,
    `## COUNTRY RISK INDEX`,
    ...risks.slice(0, 5).map((r) => `- ${r.country}: ${r.score}/100 — ${r.label}`),
    ``,
    ...(majorQuakes.length > 0 ? [
      `## SEISMIC ACTIVITY`,
      ...majorQuakes.slice(0, 5).map((q) => `- M${q.magnitude.toFixed(1)} — ${q.place} (depth ${q.depth.toFixed(0)} km)`),
      ``,
    ] : []),
    ...(country ? [
      `## COUNTRY FOCUS: ${country.toUpperCase()}`,
      ...events.filter((e) => e.country?.toLowerCase().includes(country.toLowerCase())).slice(0, 5).map((e) => `- [${e.severity.toUpperCase()}] ${e.title}`),
      ``,
    ] : []),
    `## NOTE`,
    `This report was generated from local platform data (AI not configured). Configure Gemini API for enhanced analytical content.`,
  ];

  return lines.join("\n");
}
