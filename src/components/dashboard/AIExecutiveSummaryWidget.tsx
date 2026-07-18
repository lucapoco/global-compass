/**
 * AIExecutiveSummaryWidget — Dashboard AI situational analysis widget.
 *
 * Auto-generates a structured executive intelligence summary using Global Pulse AI.
 * Structured output: Situation · Priority Event · Focus Areas · Assessment.
 * Falls back to a local computation when AI is unavailable — never shows empty.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Brain, RefreshCw, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { useT } from "@/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataBadge } from "@/components/ui/DataBadge";
import { Button } from "@/components/ui/button";
import type { IntelligenceItem, Earthquake, CountryRisk } from "@/types";

interface Props {
  intel: IntelligenceItem[];
  quakes: Earthquake[];
  risks?: CountryRisk[];
}

interface ParsedSummary {
  situation: string;
  priorityEvent: string;
  focusAreas: string[];
  assessment: string;
}

function parseSummary(content: string): ParsedSummary {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  let situation = "", priorityEvent = "", assessment = "";
  const focusAreas: string[] = [];
  let current: "sit" | "pri" | "foc" | "ass" | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes("SITUATION")) { current = "sit"; continue; }
    if (upper.includes("PRIORITY") || upper.includes("KEY EVENT")) { current = "pri"; continue; }
    if (upper.includes("FOCUS") || upper.includes("MONITOR")) { current = "foc"; continue; }
    if (upper.includes("ASSESSMENT") || upper.includes("CONCLUSION")) { current = "ass"; continue; }
    const clean = line.replace(/^\*+|^#+|^-\s*/, "").trim();
    if (!clean) continue;
    if (current === "sit") situation += (situation ? " " : "") + clean;
    else if (current === "pri") priorityEvent += (priorityEvent ? " " : "") + clean;
    else if (current === "foc") focusAreas.push(clean);
    else if (current === "ass") assessment += (assessment ? " " : "") + clean;
  }

  if (!situation && lines.length > 0) {
    situation = lines.slice(0, 2).join(" ");
    if (lines.length > 2) priorityEvent = lines[2];
    if (lines.length > 3) assessment = lines[lines.length - 1];
  }

  return { situation, priorityEvent, focusAreas, assessment };
}

function buildLocalSummary(intel: IntelligenceItem[], quakes: Earthquake[], risks: CountryRisk[]): ParsedSummary {
  const critical = intel.filter((i) => i.severity === "critical");
  const high = intel.filter((i) => i.severity === "high");
  const maxQ = quakes.reduce((m, q) => q.magnitude > m ? q.magnitude : m, 0);
  const topRisk = risks[0];

  const situation = critical.length > 0
    ? `${critical.length} critical and ${high.length} high-priority intelligence events are currently active. Global activity levels are elevated across multiple sectors.`
    : high.length > 0
    ? `${high.length} high-priority intelligence events are active. The global situation requires close monitoring.`
    : "No critical threats detected. The global intelligence picture is currently stable across monitored sectors.";

  const priorityEvent = critical[0]?.title ?? high[0]?.title ?? "No priority events in current feed.";

  const focusAreas: string[] = [];
  if (topRisk) focusAreas.push(`${topRisk.country} — Risk Score ${topRisk.score}/100`);
  if (maxQ >= 5) focusAreas.push(`Seismic activity — M${maxQ.toFixed(1)} earthquake detected`);
  if (critical.length > 0) focusAreas.push(`${critical[0]?.category ?? "General"} sector — critical events active`);

  const assessment = `Platform monitoring ${intel.length} intelligence events and ${quakes.length} seismic readings. AI analysis requires Gemini API configuration.`;

  return { situation, priorityEvent, focusAreas, assessment };
}

export function AIExecutiveSummaryWidget({ intel, quakes, risks = [] }: Props) {
  const t = useT();
  const [summary, setSummary] = useState<ParsedSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const hasGenerated = useRef(false);

  const generate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const critical = intel.filter((i) => i.severity === "critical");
      const high = intel.filter((i) => i.severity === "high");
      const topCountries = [...new Set(intel.slice(0, 20).map((i) => i.country).filter(Boolean) as string[])].slice(0, 4);
      const maxQ = quakes.reduce((m, q) => q.magnitude > m ? q.magnitude : m, 0);

      const prompt = `Generate a concise intelligence executive summary. Use EXACTLY this structure:\n\nSITUATION:\n[2-3 sentences describing the current global situation]\n\nPRIORITY EVENT:\n[The single most important development]\n\nFOCUS AREAS:\n- [Area 1]\n- [Area 2]\n- [Area 3]\n\nASSESSMENT:\n[One-sentence conclusion]\n\nDATA: ${critical.length} critical, ${high.length} high events. Largest earthquake: M${maxQ.toFixed(1)}. Countries: ${topCountries.join(", ") || "Global"}. Top risk: ${risks[0] ? `${risks[0].country} (${risks[0].score}/100)` : "N/A"}. Critical: ${critical.slice(0, 2).map((e) => e.title).join(" | ") || "None"}`;

      const res = await fetch("/api/ai-news-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: {
            dataStatus: { news: "live", earthquakes: "live", supabase: "na", overall: "live" },
            newsSource: "GNews", lastUpdated: new Date().toISOString(),
            intelligenceItems: intel.slice(0, 5), criticalAlerts: [],
            earthquakes: quakes.slice(0, 3), countryRisks: risks.slice(0, 3),
            savedDataSummary: { intelligenceCount: 0, alertsCount: 0, countriesCount: 0 },
            apiHealth: { gnews: "live", usgs: "live", supabase: "na", openWeather: "na", map: "na" },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await res.json()) as { answer?: string; fallbackAnswer?: string; error?: string };
      const content = data.answer ?? data.fallbackAnswer;
      if (content && !data.error) { setSummary(parseSummary(content)); setAiUsed(true); }
      else { setSummary(buildLocalSummary(intel, quakes, risks)); setAiUsed(false); }
    } catch {
      setSummary(buildLocalSummary(intel, quakes, risks));
      setAiUsed(false);
    } finally {
      setLoading(false);
    }
  }, [intel, quakes, risks, loading]);

  useEffect(() => {
    if (!hasGenerated.current && intel.length > 0) {
      hasGenerated.current = true;
      void generate();
    }
  }, [intel, generate]);

  return (
    <div className="glass-card p-4" aria-label={t("app.pages.dashboard.aiSummary.title")}>
      <SectionHeader
        title={t("app.pages.dashboard.aiSummary.title")}
        subtitle={t("app.pages.dashboard.aiSummary.subtitle")}
        right={
          <div className="flex items-center gap-2">
            {aiUsed ? <DataBadge variant="live">{t("app.ui.dataStatus.live")}</DataBadge> : <DataBadge variant="neutral">{t("app.ui.dataStatus.demo")}</DataBadge>}
            <Button variant="ghost" size="icon-sm" onClick={() => void generate()} disabled={loading} aria-label={t("app.ui.refresh")}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
        size="sm"
      />

      {loading && !summary ? (
        <div className="space-y-3">
          {[90, 75, 85, 60].map((w, i) => <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />)}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5 animate-pulse text-primary" aria-hidden="true" />
            <span>{t("app.pages.dashboard.aiSummary.analyzing", { count: intel.length })}</span>
          </div>
        </div>
      ) : summary ? (
        <div className="panel-scroll space-y-3 animate-fade-in">
          {summary.situation && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                <span className="text-label text-primary">Situation</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{summary.situation}</p>
            </div>
          )}
          {summary.priorityEvent && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-label text-rose-400 mb-1.5">Priority Event</div>
              <p className="text-xs text-foreground/90 leading-snug">{summary.priorityEvent}</p>
            </div>
          )}
          {summary.focusAreas.length > 0 && (
            <div>
              <div className="text-label text-muted-foreground mb-1.5">Focus Areas</div>
              <ul className="space-y-1" role="list">
                {summary.focusAreas.map((area, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" aria-hidden="true" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.assessment && (
            <div className="border-t border-border/30 pt-2">
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">{summary.assessment}</p>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Brain className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.ui.loading")}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Brain className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
          {t("app.ui.loading")}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Link to="/ai-news" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-primary hover:bg-primary/15 transition-colors">
          <Brain className="h-3.5 w-3.5" aria-hidden="true" /> {t("app.pages.dashboard.aiSummary.openAi")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Link to="/reports" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
          {t("app.pages.dashboard.aiSummary.generateReport")}
        </Link>
      </div>
    </div>
  );
}
