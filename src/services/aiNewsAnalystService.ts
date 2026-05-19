/**
 * Global Pulse AI — context builder + Gemini chat client + local rule-based fallback.
 * Primary path: POST /api/ai-news-chat (server holds GEMINI_API_KEY).
 * Fallback: generateLocalFallbackResponse when Gemini is unavailable.
 */

import type { CountryRisk, Earthquake, GlobalEvent, IntelligenceItem, SavedIntelligence } from "@/types";
import type {
  AIChatStatus,
  AIChatTurn,
  AIProviderStatusResponse,
  CompactIntelItem,
  GeminiProviderStatus,
  LLMChatContextPayload,
} from "@/lib/aiChatTypes";
import { fetchIntelligence, detectCountry, type NewsStatus } from "@/services/newsApi";
import { getEarthquakes } from "@/services/earthquakesApi";
import { buildCountryRiskIndex } from "@/services/riskService";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";

export type AINewsMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Response source status for badges and degraded-mode copy. */
  aiStatus?: AIChatStatus;
  /** True when the rule-based fallback answered instead of Gemini. */
  localFallback?: boolean;
  /** @deprecated Use aiStatus === "GEMINI LIVE" */
  geminiLive?: boolean;
  model?: string;
  retryCount?: number;
};

export const WELCOME_MESSAGE = `Hi! I'm **Global Pulse AI**, the intelligent assistant of this platform. I can help you understand breaking news, global alerts, the world map, risk scores, and how to use the app.

Ask me about live headlines, earthquakes, country risk, or how any part of Global Pulse works. I only use data loaded in the app — I don't browse the open internet.`;

export const SUGGESTED_PROMPTS = [
  "Explain how Global Pulse works",
  "Give me a global briefing",
  "What are the most important breaking news?",
  "Show critical alerts",
  "What is happening on the map?",
  "Explain the Country Risk Index",
  "What does LIVE/CACHED/DEMO mean?",
  "What are the latest earthquakes?",
  "Summarize cyber risks",
  "What countries are highest risk?",
  "How do I use Simple View?",
  "How do I use Advanced View?",
  "What data is saved in Supabase?",
] as const;

export type AINewsContext = {
  intelligenceItems: GlobalEvent[];
  criticalAlerts: GlobalEvent[];
  earthquakes: GlobalEvent[];
  savedIntelligence?: SavedIntelligence[];
  countryRisks?: CountryRisk[];
  dataStatus: {
    news: string;
    earthquakes: string;
    supabase: string;
  };
  newsStatus: NewsStatus;
  newsSource: string;
  lastUpdated: string | null;
  isDemo: boolean;
  savedAlertsCount?: number;
  savedCountriesCount?: number;
};

const EUROPE_COUNTRIES = new Set([
  "UK",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Romania",
  "Poland",
  "Ukraine",
  "Russia",
  "Greece",
  "Sweden",
  "Norway",
  "Finland",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Portugal",
  "Ireland",
  "Denmark",
  "Hungary",
  "Czech",
  "Bulgaria",
]);

function magToSeverity(m: number): GlobalEvent["severity"] {
  if (m >= 6) return "critical";
  if (m >= 5) return "high";
  if (m >= 4) return "medium";
  return "low";
}

function intelToGlobalEvent(item: IntelligenceItem, isDemo: boolean): GlobalEvent {
  return {
    id: `intel-${item.id}`,
    title: item.title,
    description: item.description,
    category: item.category === "technology" ? "technology" : item.category,
    severity: item.severity,
    layer: "intelligence",
    source: item.source,
    url: item.url,
    country: item.country,
    location: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
    publishedAt: item.publishedAt,
    isLive: item.isLive && !isDemo,
    isDemo: isDemo || !item.isLive,
  };
}

function quakeToGlobalEvent(q: Earthquake): GlobalEvent {
  return {
    id: `eq-${q.id}`,
    title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
    description: `Depth ${q.depth.toFixed(1)} km`,
    category: "earthquake",
    severity: magToSeverity(q.magnitude),
    layer: "earthquakes",
    source: "USGS",
    url: q.url,
    location: q.place,
    latitude: q.latitude,
    longitude: q.longitude,
    publishedAt: new Date(q.time).toISOString(),
    isLive: true,
  };
}

function newsStatusLabel(status: NewsStatus): string {
  switch (status) {
    case "live":
      return "LIVE";
    case "cached":
      return "CACHED LIVE DATA";
    case "demo":
      return "DEMO";
    case "rate_limited":
      return "RATE LIMITED";
    case "error":
      return "API ERROR";
    default:
      return "UNKNOWN";
  }
}

function eventBlob(e: GlobalEvent): string {
  return [e.title, e.description ?? "", e.country ?? "", e.location ?? "", e.category, e.severity].join(" ");
}

function sortBySeverityThenDate(events: GlobalEvent[]): GlobalEvent[] {
  const rank: Record<GlobalEvent["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...events].sort((a, b) => {
    const d = rank[a.severity] - rank[b.severity];
    if (d !== 0) return d;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

function formatEvents(events: GlobalEvent[], max = 6): string {
  if (!events.length) return "_No matching events in the current dataset._";
  return events.slice(0, max).map((e, i) => {
    const when = new Date(e.publishedAt).toLocaleString();
    const loc = e.country ?? e.location ?? "—";
    const demo = e.isDemo ? " · demo" : "";
    return `${i + 1}. **${e.title}** (${e.severity} · ${e.category}) — ${e.source} · ${loc} · ${when}${demo}`;
  }).join("\n");
}

function dataFooter(ctx: AINewsContext): string {
  const ts = ctx.lastUpdated ? new Date(ctx.lastUpdated).toLocaleString() : "unknown time";
  const newsLine = `News: ${ctx.dataStatus.news} (${ctx.newsSource})`;
  const eqLine = `Earthquakes: ${ctx.dataStatus.earthquakes}`;
  const sbLine = `Supabase: ${ctx.dataStatus.supabase}`;
  let note = `Based on ${ctx.dataStatus.news.toLowerCase()} intelligence`;
  if (ctx.newsStatus === "cached") note += ` from cache`;
  if (ctx.isDemo) note += `. **Demo fallback is active — this is not a live briefing.**`;
  else if (ctx.newsStatus === "live") note += ` (live).`;
  else if (ctx.newsStatus === "rate_limited") note += `. GNews rate limit reached — showing cached/demo data.`;
  return `\n---\n**Data status:** ${newsLine} · ${eqLine} · ${sbLine}\n${note} Last context update: ${ts}.`;
}

function matchCountryInQuestion(q: string): string | undefined {
  return detectCountry(q);
}

function filterByCountry(events: GlobalEvent[], country: string): GlobalEvent[] {
  const c = country.toLowerCase();
  return events.filter((e) => eventBlob(e).toLowerCase().includes(c));
}

function filterEurope(events: GlobalEvent[]): GlobalEvent[] {
  return events.filter((e) => {
    if (e.country && EUROPE_COUNTRIES.has(e.country)) return true;
    const blob = eventBlob(e).toLowerCase();
    return [...EUROPE_COUNTRIES].some((name) => blob.includes(name.toLowerCase()));
  });
}

function filterCategory(events: GlobalEvent[], cats: GlobalEvent["category"][]): GlobalEvent[] {
  const set = new Set(cats);
  return events.filter((e) => set.has(e.category));
}

function hasAny(...words: string[]) {
  return (q: string) => words.some((w) => q.includes(w));
}

function buildBriefing(ctx: AINewsContext): string {
  const top = sortBySeverityThenDate(ctx.intelligenceItems).slice(0, 5);
  const quakes = sortBySeverityThenDate(ctx.earthquakes).slice(0, 3);
  const risks = (ctx.countryRisks ?? []).slice(0, 5);

  let body = `**Summary:** Global situational snapshot from ${ctx.intelligenceItems.length} intelligence headline(s), ${ctx.criticalAlerts.length} high/critical alert(s), and ${ctx.earthquakes.length} earthquake(s) in the last 24h feed.\n\n`;
  body += `**Key events (intelligence):**\n${formatEvents(top, 5)}\n\n`;
  if (quakes.length) {
    body += `**Earthquakes:**\n${formatEvents(quakes, 3)}\n\n`;
  } else {
    body += `**Earthquakes:** No significant events in the current USGS day feed.\n\n`;
  }
  if (risks.length) {
    body += `**Highest country risk (computed index):**\n`;
    body += risks.map((r, i) => `${i + 1}. ${r.country} — score ${r.score} (${r.label})`).join("\n");
    body += "\n\n";
  }
  body += `**Why it matters:** Prioritize critical/high signals for map, alerts, and analyst review. Cross-check demo or cached labels before operational decisions.`;
  return body + dataFooter(ctx);
}

function respondCritical(ctx: AINewsContext): string {
  const items = sortBySeverityThenDate(ctx.criticalAlerts);
  if (!items.length) {
    return `I don't have enough live data for critical/high alerts in the current feed.${dataFooter(ctx)}`;
  }
  return `**Summary:** ${items.length} high or critical signal(s) in the current dataset.\n\n**Key events:**\n${formatEvents(items, 8)}\n\n**Why it matters:** These items are prioritized for dashboard, map, and Global Alerts views.${dataFooter(ctx)}`;
}

function respondEarthquakes(ctx: AINewsContext): string {
  const items = sortBySeverityThenDate(ctx.earthquakes);
  if (!items.length) {
    return `No earthquakes are present in the current USGS day feed.${dataFooter(ctx)}`;
  }
  return `**Summary:** ${items.length} earthquake(s) from USGS (last 24h).\n\n**Events:**\n${formatEvents(items, 8)}\n\n**Why it matters:** Magnitude ≥5 events may warrant map focus and alert correlation.${dataFooter(ctx)}`;
}

function respondCategory(ctx: AINewsContext, label: string, events: GlobalEvent[]): string {
  const items = sortBySeverityThenDate(events);
  if (!items.length) {
    return `I don't have enough live data for ${label} in the current feed.${dataFooter(ctx)}`;
  }
  return `**Summary:** ${items.length} ${label} item(s).\n\n**Key events:**\n${formatEvents(items, 8)}\n\n**Why it matters:** Filtered from normalized GNews/intelligence headlines — not invented.${dataFooter(ctx)}`;
}

function respondCountry(ctx: AINewsContext, country: string): string {
  const pool = [...ctx.intelligenceItems, ...ctx.earthquakes];
  const items = sortBySeverityThenDate(filterByCountry(pool, country));
  if (!items.length) {
    return `I don't have enough live data mentioning **${country}** in the current feed.${dataFooter(ctx)}`;
  }
  return `**Summary:** ${items.length} event(s) referencing **${country}**.\n\n**Key events:**\n${formatEvents(items, 8)}\n\n**Why it matters:** Country match uses title, description, and location fields only.${dataFooter(ctx)}`;
}

function respondEurope(ctx: AINewsContext): string {
  const items = sortBySeverityThenDate(filterEurope([...ctx.intelligenceItems, ...ctx.earthquakes]));
  if (!items.length) {
    return `I don't have enough live data for Europe in the current feed.${dataFooter(ctx)}`;
  }
  return `**Summary:** ${items.length} Europe-related signal(s).\n\n**Key events:**\n${formatEvents(items, 8)}\n\n**Why it matters:** Matches known European country names in headline metadata.${dataFooter(ctx)}`;
}

function respondRisks(ctx: AINewsContext): string {
  const risks = ctx.countryRisks ?? [];
  if (!risks.length) {
    return `Country risk index is empty — need intelligence with country tags and/or earthquakes.${dataFooter(ctx)}`;
  }
  const lines = risks.slice(0, 10).map((r, i) => `${i + 1}. **${r.country}** — ${r.score}/100 (${r.label}) · ${r.factors.slice(0, 3).join(", ")}`);
  return `**Summary:** Top countries by combined news + earthquake + saved alert weights.\n\n**Rankings:**\n${lines.join("\n")}\n\n**Why it matters:** Explainable index from existing app data — not a prediction model.${dataFooter(ctx)}`;
}

function respondHeadlines(ctx: AINewsContext): string {
  const items = sortBySeverityThenDate(ctx.intelligenceItems).slice(0, 10);
  if (!items.length) {
    return `I don't have enough live data for headlines right now.${dataFooter(ctx)}`;
  }
  return `**Summary:** Latest normalized headlines (${items.length} shown).\n\n**Headlines:**\n${formatEvents(items, 10)}\n\n**Why it matters:** Sorted by severity, then recency.${dataFooter(ctx)}`;
}

function respondSaved(ctx: AINewsContext): string {
  const saved = ctx.savedIntelligence ?? [];
  if (!saved.length) {
    const msg = isSupabaseConfigured()
      ? "No saved intelligence items in Supabase yet."
      : "Supabase is not configured — saved intelligence unavailable.";
    return `${msg}${dataFooter(ctx)}`;
  }
  const lines = saved.slice(0, 8).map((s, i) => {
    const when = s.created_at ? new Date(s.created_at).toLocaleString() : "—";
    return `${i + 1}. **${s.title}** (${s.severity ?? "—"} · ${s.category ?? "general"}) — saved ${when}`;
  });
  return `**Summary:** ${saved.length} item(s) in saved_intelligence.\n\n**Saved items:**\n${lines.join("\n")}\n\n**Why it matters:** User-curated bookmarks from the intelligence feed.${dataFooter(ctx)}`;
}

function respondDefault(ctx: AINewsContext): string {
  return (
    `I analyze **only** data already loaded in Global Pulse (GNews proxy, USGS, Supabase, risk index).\n\n` +
    `Try:\n` +
    SUGGESTED_PROMPTS.slice(0, 5).map((p) => `• ${p}`).join("\n") +
    dataFooter(ctx)
  );
}

export async function buildNewsContext(opts?: { force?: boolean }): Promise<AINewsContext> {
  let newsStatus: NewsStatus = "demo";
  let newsSource = "Demo";
  let lastUpdated: string | null = null;
  let isDemo = true;
  let intelligenceItems: GlobalEvent[] = [];
  let earthquakes: GlobalEvent[] = [];
  let savedIntelligence: SavedIntelligence[] | undefined;
  let savedAlerts: import("@/types").SavedAlert[] = [];
  let savedCountriesCount = 0;
  let quakes: Earthquake[] = [];

  try {
    const news = await fetchIntelligence({ limit: 30, force: opts?.force });
    newsStatus = news.status;
    newsSource = news.source;
    lastUpdated = news.lastUpdated ?? (news.cachedAt ? new Date(news.cachedAt).toISOString() : null);
    isDemo = news.status === "demo" || news.source === "Demo";
    intelligenceItems = news.items.map((i) => intelToGlobalEvent(i, isDemo));
  } catch {
    /* keep empty */
  }

  let eqStatus = "ERROR";
  try {
    quakes = await getEarthquakes("day");
    earthquakes = quakes.map(quakeToGlobalEvent);
    eqStatus = "LIVE";
  } catch {
    eqStatus = "UNAVAILABLE";
  }

  let sbStatus = "NOT CONFIGURED";
  if (isSupabaseConfigured()) {
    sbStatus = "CONFIGURED";
    try {
      savedIntelligence = await supabaseService.listSavedIntelligence();
    } catch {
      sbStatus = "ERROR";
    }
    try {
      savedAlerts = await supabaseService.listSavedAlerts();
    } catch {
      /* ignore */
    }
    try {
      savedCountriesCount = (await supabaseService.listSavedCountries()).length;
    } catch {
      /* ignore */
    }
  }

  const criticalAlerts = sortBySeverityThenDate(
    intelligenceItems.filter((e) => e.severity === "critical" || e.severity === "high"),
  );

  let countryRisks: CountryRisk[] | undefined;
  try {
    const intelItems = intelligenceItems.map(
      (e): IntelligenceItem => ({
        id: e.id,
        title: e.title,
        description: e.description ?? "",
        category: e.category === "earthquake" || e.category === "weather" ? "general" : e.category,
        severity: e.severity,
        country: e.country,
        source: e.source,
        url: e.url,
        publishedAt: e.publishedAt,
        isLive: e.isLive,
      }),
    );
    countryRisks = buildCountryRiskIndex({ intel: intelItems, quakes, saved: savedAlerts });
  } catch {
    countryRisks = [];
  }

  return {
    intelligenceItems,
    criticalAlerts,
    earthquakes,
    savedIntelligence,
    countryRisks,
    dataStatus: {
      news: newsStatusLabel(newsStatus),
      earthquakes: eqStatus,
      supabase: sbStatus,
    },
    newsStatus,
    newsSource,
    lastUpdated,
    isDemo,
    savedAlertsCount: savedAlerts.length,
    savedCountriesCount,
  };
}

function eventDataLabel(e: GlobalEvent, ctx: AINewsContext): CompactIntelItem["dataLabel"] {
  if (e.isDemo || ctx.isDemo) return "DEMO";
  if (ctx.newsStatus === "cached") return "CACHED";
  if (e.isLive && ctx.newsStatus === "live") return "LIVE";
  if (e.layer === "earthquakes") return "LIVE";
  return "CACHED";
}

function toCompactItem(e: GlobalEvent, ctx: AINewsContext): CompactIntelItem {
  return {
    id: e.id,
    title: e.title,
    description: e.description?.slice(0, 280),
    category: e.category,
    severity: e.severity,
    source: e.source,
    country: e.country,
    location: e.location,
    publishedAt: e.publishedAt,
    dataLabel: eventDataLabel(e, ctx),
    url: e.url,
  };
}

/** Compact payload for the server-side Gemini prompt (limits enforced). */
export function buildLLMContextPayload(ctx: AINewsContext): LLMChatContextPayload {
  const overall =
    ctx.isDemo || ctx.newsStatus === "demo"
      ? "DEMO"
      : ctx.newsStatus === "cached"
        ? "CACHED LIVE DATA"
        : ctx.newsStatus === "live"
          ? "LIVE"
          : ctx.dataStatus.news;

  return {
    dataStatus: {
      news: ctx.dataStatus.news,
      earthquakes: ctx.dataStatus.earthquakes,
      supabase: ctx.dataStatus.supabase,
      overall,
    },
    newsSource: ctx.newsSource,
    lastUpdated: ctx.lastUpdated,
    intelligenceItems: ctx.intelligenceItems.slice(0, 30).map((e) => toCompactItem(e, ctx)),
    criticalAlerts: ctx.criticalAlerts.slice(0, 20).map((e) => toCompactItem(e, ctx)),
    earthquakes: ctx.earthquakes.slice(0, 10).map((e) => toCompactItem(e, ctx)),
    countryRisks: (ctx.countryRisks ?? []).slice(0, 10).map((r) => ({
      country: r.country,
      score: r.score,
      label: r.label,
      factors: r.factors.slice(0, 4),
    })),
    savedDataSummary: {
      intelligenceCount: ctx.savedIntelligence?.length ?? 0,
      alertsCount: ctx.savedAlertsCount ?? 0,
      countriesCount: ctx.savedCountriesCount ?? 0,
    },
    apiHealth: {
      gnews: `${ctx.dataStatus.news} (${ctx.newsSource})`,
      usgs: ctx.dataStatus.earthquakes,
      supabase: ctx.dataStatus.supabase,
      openWeather: import.meta.env.VITE_OPENWEATHER_API_KEY ? "key configured" : "not configured / demo fallback",
      map: import.meta.env.VITE_MAPBOX_TOKEN ? "Mapbox token present" : "not configured / map fallback",
    },
  };
}

export type GlobalPulseAIChatResult = {
  answer: string;
  provider?: "Google Gemini" | "Local Analyst";
  model?: string;
  status?: AIChatStatus;
  localFallback: boolean;
  geminiLive?: boolean;
  retryCount?: number;
  errorMessage?: string;
};

/** Provider status for /ai-news context panel (no API key exposed). */
export async function fetchGeminiProviderStatus(): Promise<{
  status: GeminiProviderStatus;
  provider: string;
  model: string;
  configured: boolean;
}> {
  try {
    const res = await fetch("/api/ai-news-chat", { method: "GET", headers: { Accept: "application/json" } });
    const data = (await res.json()) as AIProviderStatusResponse;
    if (!data.configured) {
      return {
        status: data.status ?? "GEMINI NOT CONFIGURED",
        provider: data.provider ?? "Google Gemini",
        model: data.model ?? "gemini-2.5-flash-lite",
        configured: false,
      };
    }
    return {
      status: data.status ?? "GEMINI LIVE",
      provider: data.provider,
      model: data.model,
      configured: true,
    };
  } catch {
    return {
      status: "GEMINI ERROR",
      provider: "Google Gemini",
      model: "gemini-2.5-flash-lite",
      configured: false,
    };
  }
}

/** Primary chat entry: Gemini via /api/ai-news-chat, then local fallback. */
export async function sendGlobalPulseAIChat(
  history: AIChatTurn[],
  userMessage: string,
  context: AINewsContext,
): Promise<GlobalPulseAIChatResult> {
  const q = userMessage.trim();
  if (!q) {
    return { answer: "Please enter a question.", localFallback: true };
  }

  const payload = buildLLMContextPayload(context);
  const messages: AIChatTurn[] = [...history, { role: "user", content: q }];

  try {
    const res = await fetch("/api/ai-news-chat", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context: payload }),
    });

    const data = (await res.json()) as {
      answer?: string;
      model?: string;
      provider?: string;
      status?: AIChatStatus | "GEMINI NOT CONFIGURED";
      error?: string;
      errorMessage?: string;
      errorCode?: string;
      configured?: boolean;
      retryCount?: number;
    };

    if (res.ok && data.answer) {
      const status = data.status === "GEMINI FALLBACK MODEL" ? "GEMINI FALLBACK MODEL" : "GEMINI LIVE";
      const notice =
        status === "GEMINI FALLBACK MODEL"
          ? "_Primary Gemini model was busy. Response generated with fallback Gemini model._\n\n"
          : "";
      return {
        answer: `${notice}${data.answer}`,
        provider: "Google Gemini",
        model: data.model,
        status,
        localFallback: false,
        geminiLive: true,
        retryCount: data.retryCount,
      };
    }

    const fb = await generateLocalFallbackResponse(q, context);
    const busy =
      data.status === "GEMINI TEMPORARILY BUSY" ||
      data.errorCode === "HIGH_DEMAND" ||
      data.errorCode === "RATE_LIMIT";

    let prefix: string;
    if (data.configured === false || data.status === "GEMINI NOT CONFIGURED") {
      prefix = "Gemini API is not configured. Using local analyst fallback based on loaded platform data.\n\n";
    } else if (busy) {
      prefix =
        "Gemini is temporarily busy. Global Pulse AI is using local fallback based on loaded platform data.\n\n";
    } else {
      prefix = `Gemini is temporarily unavailable. Using local analyst fallback based on loaded platform data.\n\n`;
    }

    return {
      answer: `${prefix}${fb}`,
      provider: "Local Analyst",
      model: "local-analyst",
      status: "LOCAL FALLBACK",
      localFallback: true,
      geminiLive: false,
      retryCount: data.retryCount,
      errorMessage: data.errorMessage ?? data.error,
    };
  } catch {
    const fb = await generateLocalFallbackResponse(q, context);
    return {
      answer: `Could not reach Gemini API. Using local analyst fallback based on loaded platform data.\n\n${fb}`,
      provider: "Local Analyst",
      model: "local-analyst",
      status: "LOCAL FALLBACK",
      localFallback: true,
      geminiLive: false,
    };
  }
}

/** Rule-based fallback when Gemini is not configured or errors. */
export async function generateLocalFallbackResponse(userQuestion: string, context: AINewsContext): Promise<string> {
  await new Promise((r) => setTimeout(r, 280));
  const q = userQuestion.trim().toLowerCase();
  if (!q) return respondDefault(context);

  if (hasAny("briefing", "summary", "overview", "global briefing")(q)) {
    return buildBriefing(context);
  }
  if (hasAny("saved intelligence", "saved items", "saved summary")(q)) {
    return respondSaved(context);
  }
  if (hasAny("earthquake", "quake", "magnitude", "usgs")(q)) {
    return respondEarthquakes(context);
  }
  if (hasAny("cyber", "hack", "ransomware", "breach")(q)) {
    return respondCategory(context, "cyber", filterCategory(context.intelligenceItems, ["cyber"]));
  }
  if (hasAny("economy", "market", "oil", "inflation", "trade")(q)) {
    return respondCategory(
      context,
      "economy/energy",
      filterCategory(context.intelligenceItems, ["economy", "energy"]),
    );
  }
  if (hasAny("military", "war", "missile", "troops", "conflict", "geopolitic")(q)) {
    return respondCategory(
      context,
      "military/geopolitics",
      filterCategory(context.intelligenceItems, ["military", "geopolitics"]),
    );
  }
  if (hasAny("critical", "urgent", "breaking", "important", "alert")(q)) {
    return respondCritical(context);
  }
  if (hasAny("europe", "european", "eu ")(q)) {
    return respondEurope(context);
  }
  if (hasAny("highest risk", "country risk", "risky countries", "risk index")(q)) {
    return respondRisks(context);
  }
  if (hasAny("headline", "major news", "latest news", "breaking news")(q)) {
    return respondHeadlines(context);
  }

  const country = matchCountryInQuestion(userQuestion);
  if (country) {
    return respondCountry(context, country);
  }

  return respondDefault(context);
}

/** @deprecated Use sendGlobalPulseAIChat — kept for compatibility */
export const generateAINewsResponse = generateLocalFallbackResponse;

export function createMessage(
  role: AINewsMessage["role"],
  content: string,
  meta?: Pick<AINewsMessage, "aiStatus" | "localFallback" | "geminiLive" | "model" | "retryCount">,
): AINewsMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...meta,
  };
}
