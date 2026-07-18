/**
 * Intelligence Reports — gather platform data, local structured generation, optional Gemini polish.
 */
import type { AIChatStatus } from "@/lib/aiChatTypes";
import type { Country, GlobalEvent, ReportType } from "@/types";
import {
  buildNewsContext,
  buildLLMContextPayload,
  type AINewsContext,
} from "@/services/aiNewsAnalystService";
import { searchCountryByName } from "@/services/countriesApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import type { SavedAlert } from "@/types";

export type ReportGenerationResult = {
  title: string;
  type: ReportType;
  country?: string;
  eventId?: string;
  content: string;
  dataStatus: string;
  aiStatus: AIChatStatus | "GEMINI FALLBACK MODEL";
  model?: string;
  generatedAt: string;
};

export type GenerateReportParams =
  | { type: "country"; country: string }
  | { type: "event"; eventId: string }
  | { type: "global_briefing" };

function overallDataStatus(ctx: AINewsContext): string {
  if (ctx.isDemo || ctx.newsStatus === "demo") return "DEMO";
  if (ctx.newsStatus === "cached") return "CACHED LIVE DATA";
  if (ctx.newsStatus === "live") return "LIVE";
  return ctx.dataStatus.news;
}

function dataFooter(ctx: AINewsContext): string {
  const status = overallDataStatus(ctx);
  return `\n\n---\n**Data status:** ${status} · News: ${ctx.dataStatus.news} (${ctx.newsSource}) · USGS: ${ctx.dataStatus.earthquakes} · Supabase: ${ctx.dataStatus.supabase}\n**Generated:** ${new Date().toISOString()}`;
}

function limitationsBlock(ctx: AINewsContext): string {
  const status = overallDataStatus(ctx);
  return `## Limitations\n- This report uses only data loaded in Global Pulse at generation time.\n- News/intelligence is **${status}** — do not treat demo or cached items as confirmed breaking news.\n- No open-internet browsing; gaps mean "insufficient data in app," not "nothing happened."\n- Risk scores are heuristic composites, not official government assessments.`;
}

function matchCountry(name: string, hay?: string): boolean {
  if (!hay) return false;
  return hay.toLowerCase().includes(name.toLowerCase());
}

function filterByCountry(items: GlobalEvent[], country: string): GlobalEvent[] {
  return items.filter((e) => matchCountry(country, e.country) || matchCountry(country, e.location) || matchCountry(country, e.title));
}

function formatEventLine(e: GlobalEvent, i: number): string {
  const label = e.isDemo ? "DEMO" : e.isLive ? "LIVE" : "CACHED";
  return `${i + 1}. **${e.title}** (${e.severity}/${e.category}, ${label}) — ${e.source}${e.country ? ` · ${e.country}` : ""}\n   ${(e.description ?? "").slice(0, 200)}`;
}

function categoryHighlights(ctx: AINewsContext, categories: string[], limit = 4): string {
  const items = ctx.intelligenceItems.filter((e) => categories.includes(e.category)).slice(0, limit);
  if (!items.length) return "_No matching headlines in current feed._";
  return items.map((e, i) => formatEventLine(e, i)).join("\n");
}

export function generateCountryReportLocal(
  ctx: AINewsContext,
  country: string,
  meta?: Country | null,
  savedAlerts: SavedAlert[] = [],
): string {
  const intel = filterByCountry(ctx.intelligenceItems, country).slice(0, 8);
  const quakes = filterByCountry(ctx.earthquakes, country).slice(0, 5);
  const risk = ctx.countryRisks?.find((r) => matchCountry(country, r.country));
  const savedIntel =
    ctx.savedIntelligence?.filter((s) => matchCountry(country, s.country ?? "") || matchCountry(country, s.title)) ??
    [];
  const countrySavedAlerts = savedAlerts.filter(
    (a) => matchCountry(country, a.location ?? "") || matchCountry(country, a.title),
  );

  const pop = meta?.population ? `Population ~${meta.population.toLocaleString()}` : "";
  const region = meta?.region ? `Region: ${meta.region}` : "";

  let body = `# Country Report: ${country}\n\n`;
  body += `## Executive summary\n`;
  body += `- Monitoring focus: **${country}** using in-app intelligence, USGS, risk index, and saved bookmarks.\n`;
  body += `- Headlines in feed: **${intel.length}** · Earthquakes (filtered): **${quakes.length}**`;
  if (risk) body += ` · Risk score: **${risk.score}** (${risk.label})`;
  body += `.\n`;

  body += `\n## Latest intelligence / news\n`;
  body += intel.length ? intel.map((e, i) => formatEventLine(e, i)).join("\n") : "_No headlines matched this country in the current feed._";

  body += `\n\n## Risk score\n`;
  if (risk) {
    body += `- Score: **${risk.score}/100** (${risk.label})\n- Factors: ${risk.factors.join("; ")}\n`;
  } else {
    body += `_No country risk entry for ${country} in the current index._\n`;
  }

  body += `\n## Recent earthquakes / disasters\n`;
  body += quakes.length
    ? quakes.map((e, i) => formatEventLine(e, i)).join("\n")
    : "_No recent USGS events matched this country in the loaded window._";

  body += `\n\n## Saved alerts & intelligence\n`;
  const savedLines = [
    ...savedIntel.slice(0, 5).map((s, i) => `${i + 1}. [Saved intel] ${s.title}`),
    ...countrySavedAlerts.slice(0, 5).map((s, i) => `${i + 1}. [Saved alert] ${s.title}`),
  ];
  body += savedLines.length ? savedLines.join("\n") : "_No saved items matched this country._";

  if (pop || region) {
    body += `\n\n## Country reference (REST Countries)\n${[pop, region].filter(Boolean).join(" · ")}\n`;
  }

  body += `\n\n${limitationsBlock(ctx)}`;
  body += dataFooter(ctx);
  return body;
}

export function generateEventReportLocal(ctx: AINewsContext, eventId: string): string {
  const event =
    ctx.intelligenceItems.find((e) => e.id === eventId) ??
    ctx.criticalAlerts.find((e) => e.id === eventId) ??
    ctx.earthquakes.find((e) => e.id === eventId);

  if (!event) {
    return `# Event Report\n\n_Event ID \`${eventId}\` was not found in the current loaded dataset._${dataFooter(ctx)}`;
  }

  const related = ctx.intelligenceItems
    .filter(
      (e) =>
        e.id !== event.id &&
        (e.category === event.category ||
          (event.country && e.country === event.country) ||
          e.severity === event.severity),
    )
    .slice(0, 6);

  const label = event.isDemo ? "DEMO" : event.isLive ? "LIVE" : "CACHED";

  let body = `# Event Report\n\n`;
  body += `## ${event.title}\n\n`;
  body += `- **Category:** ${event.category}\n`;
  body += `- **Severity:** ${event.severity}\n`;
  body += `- **Source:** ${event.source}\n`;
  body += `- **Location / country:** ${event.location ?? event.country ?? "—"}\n`;
  body += `- **Published:** ${new Date(event.publishedAt).toLocaleString()}\n`;
  body += `- **Data label:** ${label}\n`;

  body += `\n## Timeline / context\n${event.description ?? "_No extended description in feed._"}\n`;

  body += `\n## Why it matters\n`;
  body += `- Severity **${event.severity}** in category **${event.category}**.\n`;
  if (event.severity === "critical" || event.severity === "high") {
    body += `- Flagged as elevated priority in the intelligence pipeline.\n`;
  } else {
    body += `- Monitor for escalation; corroborate with map and country risk views.\n`;
  }

  body += `\n## Related events\n`;
  body += related.length ? related.map((e, i) => formatEventLine(e, i)).join("\n") : "_No closely related items in current feed._";

  body += `\n## Recommended follow-up\n`;
  body += `- Open **Live World Map** and filter by ${event.country ?? "region"}.\n`;
  body += `- Check **Country Risk** and **Intelligence Feed** for updates.\n`;
  body += `- Save to Supabase bookmarks if Supabase is configured.\n`;

  body += `\n\n${limitationsBlock(ctx)}`;
  body += dataFooter(ctx);
  return body;
}

export function generateGlobalBriefingLocal(ctx: AINewsContext): string {
  const topCritical = [...ctx.criticalAlerts].slice(0, 8);
  const topRisks = (ctx.countryRisks ?? []).slice(0, 6);
  const quakes = ctx.earthquakes.slice(0, 6);

  let body = `# Global Intelligence Briefing\n\n`;
  body += `## Executive summary\n`;
  body += `- Intelligence items loaded: **${ctx.intelligenceItems.length}** (critical/high: **${ctx.criticalAlerts.length}**).\n`;
  body += `- Earthquakes (USGS window): **${ctx.earthquakes.length}**.\n`;
  body += `- Overall data mode: **${overallDataStatus(ctx)}**.\n`;

  body += `\n## Top critical / high events\n`;
  body += topCritical.length ? topCritical.map((e, i) => formatEventLine(e, i)).join("\n") : "_None in current feed._";

  body += `\n\n## Top risk countries\n`;
  body += topRisks.length
    ? topRisks.map((r, i) => `${i + 1}. **${r.country}** — score ${r.score} (${r.label})`).join("\n")
    : "_Risk index unavailable._";

  body += `\n\n## Latest earthquakes\n`;
  body += quakes.length ? quakes.map((e, i) => formatEventLine(e, i)).join("\n") : "_No earthquakes loaded._";

  body += `\n\n## Cyber highlights\n${categoryHighlights(ctx, ["cyber"])}\n`;
  body += `\n## Economy / energy highlights\n${categoryHighlights(ctx, ["economy", "energy"])}\n`;
  body += `\n## Military / geopolitics highlights\n${categoryHighlights(ctx, ["military", "geopolitics"])}\n`;

  body += `\n\n## Data source status\n`;
  body += `- GNews intelligence: ${ctx.dataStatus.news} (${ctx.newsSource})\n`;
  body += `- USGS earthquakes: ${ctx.dataStatus.earthquakes}\n`;
  body += `- Supabase saved data: ${ctx.dataStatus.supabase}\n`;

  body += `\n\n${limitationsBlock(ctx)}`;
  body += dataFooter(ctx);
  return body;
}

function reportTitle(type: ReportType, country?: string, event?: GlobalEvent): string {
  const ts = new Date().toLocaleString();
  if (type === "country" && country) return `Country Report — ${country} (${ts})`;
  if (type === "event" && event) return `Event Report — ${event.title.slice(0, 60)} (${ts})`;
  return `Global Briefing (${ts})`;
}

async function enhanceWithGemini(
  draft: string,
  type: ReportType,
  ctx: AINewsContext,
  meta: { country?: string; eventId?: string },
): Promise<{ content: string; aiStatus: AIChatStatus | "GEMINI FALLBACK MODEL"; model?: string } | null> {
  const payload = buildLLMContextPayload(ctx);
  const instruction =
    type === "country"
      ? `Produce a polished Country Report for ${meta.country}. Use ONLY facts from the draft and JSON context. Keep all sections. Do not invent events.`
      : type === "event"
        ? `Produce a polished Event Report for event id ${meta.eventId}. Use ONLY facts from the draft and JSON context.`
        : `Produce a polished Global Intelligence Briefing. Use ONLY facts from the draft and JSON context.`;

  try {
    const res = await fetch("/api/generate-report", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        country: meta.country,
        eventId: meta.eventId,
        draft,
        context: payload,
        instruction,
      }),
    });
    const data = (await res.json()) as {
      content?: string;
      status?: string;
      model?: string;
      error?: string;
    };
    if (res.ok && data.content) {
      const status = data.status === "GEMINI FALLBACK MODEL" ? "GEMINI FALLBACK MODEL" : "GEMINI LIVE";
      return { content: data.content, aiStatus: status, model: data.model };
    }
  } catch {
    /* use local draft */
  }
  return null;
}

export async function generateReport(params: GenerateReportParams): Promise<ReportGenerationResult> {
  const ctx = await buildNewsContext({ force: true });
  const dataStatus = overallDataStatus(ctx);
  const generatedAt = new Date().toISOString();

  let content: string;
  let title: string;
  let country: string | undefined;
  let eventId: string | undefined;
  let event: GlobalEvent | undefined;

  if (params.type === "country") {
    country = params.country.trim();
    let meta: Country | null = null;
    let savedAlerts: SavedAlert[] = [];
    try {
      const found = await searchCountryByName(country);
      meta = found[0] ?? null;
      if (meta?.name?.common && !country) country = meta.name.common;
    } catch {
      /* optional REST enrichment */
    }
    if (isSupabaseConfigured()) {
      try {
        savedAlerts = await supabaseService.listSavedAlerts();
      } catch {
        /* ignore */
      }
    }
    content = generateCountryReportLocal(ctx, country, meta, savedAlerts);
    title = reportTitle("country", country);
  } else if (params.type === "event") {
    eventId = params.eventId;
    event =
      ctx.intelligenceItems.find((e) => e.id === eventId) ??
      ctx.criticalAlerts.find((e) => e.id === eventId) ??
      ctx.earthquakes.find((e) => e.id === eventId);
    content = generateEventReportLocal(ctx, eventId);
    title = reportTitle("event", undefined, event);
  } else {
    content = generateGlobalBriefingLocal(ctx);
    title = reportTitle("global_briefing");
  }

  const enhanced = await enhanceWithGemini(content, params.type, ctx, { country, eventId });
  if (enhanced) {
    return {
      title,
      type: params.type,
      country,
      eventId,
      content: enhanced.content,
      dataStatus,
      aiStatus: enhanced.aiStatus,
      model: enhanced.model,
      generatedAt,
    };
  }

  return {
    title,
    type: params.type,
    country,
    eventId,
    content,
    dataStatus,
    aiStatus: "LOCAL FALLBACK",
    model: "local-analyst",
    generatedAt,
  };
}

export function reportTypeLabel(type: ReportType): string {
  switch (type) {
    case "country":
      return "Country Report";
    case "event":
      return "Event Report";
    default:
      return "Global Briefing";
  }
}
