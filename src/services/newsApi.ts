import type { IntelligenceItem, IntelligenceCategory, IntelligenceSeverity } from "@/types";
import { demoNews } from "@/data/demoNews";

/**
 * Centralized news service.
 *
 * Why caching: GNews free tier rate-limits aggressively (HTTP 429). To keep
 * the dashboard stable during a presentation we cache successful responses in
 * localStorage for 10 minutes and serve them across all pages (Dashboard,
 * Intelligence Feed, Global Alerts, Map). Every page MUST go through
 * `fetchIntelligence()` — never call gnews.io directly.
 */

const GNEWS_KEY =
  (import.meta.env.VITE_GNEWS_API_KEY as string | undefined) ||
  "554e73d2cc17d3bd98f183a3e033f43a";
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY as string | undefined;

const CACHE_KEY = "global_pulse_gnews_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type NewsStatus = "live" | "cached" | "demo" | "error" | "rate_limited";
export interface NewsResult {
  items: IntelligenceItem[];
  status: NewsStatus;
  message?: string;
  cachedAt?: number;
}

interface CacheEntry {
  items: IntelligenceItem[];
  timestamp: number;
  key: string;
}

const GNEWS_CATEGORIES = [
  "general", "world", "nation", "business", "technology", "science", "health", "sports", "entertainment",
] as const;

const CATEGORY_RULES: Array<[IntelligenceCategory, RegExp]> = [
  ["military",   /\b(war|missile|attack|troops?|military|defense|invasion|airstrike|army|nato|navy)\b/i],
  ["geopolitics",/\b(election|government|president|border|diplomacy|sanctions?|treaty|summit|parliament|prime minister)\b/i],
  ["economy",    /\b(stock|inflation|markets?|economy|bank|oil|gas|gdp|recession|tariff|currency|trade)\b/i],
  ["cyber",      /\b(cyber|hack(ed|ing)?|malware|ransomware|breach|phishing|exploit)\b/i],
  ["disaster",   /\b(earthquake|flood|wildfire|storm|hurricane|tsunami|disaster|tornado|landslide)\b/i],
  ["climate",    /\b(climate|heatwave|emissions|temperature|drought|warming|carbon)\b/i],
  ["technology", /\b(\bai\b|chip|software|technology|startup|robot|silicon|semiconductor|data center)\b/i],
  ["energy",     /\b(energy|nuclear|reactor|pipeline|grid|electricity|solar|wind farm)\b/i],
  ["health",     /\b(virus|disease|hospital|health|outbreak|pandemic|vaccine)\b/i],
];

const CRITICAL = /\b(war|invasion|nuclear|missile|earthquake|dead|killed|emergency|attack|massacre|fatal)\b/i;
const HIGH = /\b(crisis|warning|conflict|sanctions|cyberattack|explosion|flood|evacuat|airstrike)\b/i;
const MEDIUM = /\b(protest|inflation|election|storm|outage|recall|strike|tension)\b/i;

export function classifyCategory(text: string): IntelligenceCategory {
  for (const [cat, rx] of CATEGORY_RULES) if (rx.test(text)) return cat;
  return "general";
}

export function classifySeverity(text: string): IntelligenceSeverity {
  if (CRITICAL.test(text)) return "critical";
  if (HIGH.test(text)) return "high";
  if (MEDIUM.test(text)) return "medium";
  return "low";
}

const COUNTRY_LIST = [
  "United States","USA","UK","United Kingdom","China","Russia","Ukraine","Israel","Palestine","Gaza",
  "Iran","Iraq","Syria","Turkey","Germany","France","Italy","Spain","Romania","Poland","Japan","India",
  "Pakistan","Brazil","Mexico","Canada","Australia","South Korea","North Korea","Saudi Arabia","Egypt",
  "Greece","Sweden","Norway","Finland","Netherlands","Belgium","Switzerland","Austria","Argentina","Chile",
  "South Africa","Nigeria","Kenya","Ethiopia","Indonesia","Vietnam","Thailand","Philippines","Singapore",
  "Hungary","Czech","Bulgaria","Portugal","Ireland","Denmark",
];

export function detectCountry(text: string): string | undefined {
  for (const c of COUNTRY_LIST) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  }
  return undefined;
}

function normalizeGNews(articles: any[]): IntelligenceItem[] {
  return articles.map((a, i) => {
    const text = `${a.title ?? ""} ${a.description ?? ""}`;
    return {
      id: a.url ?? `gn-${i}-${a.publishedAt ?? Date.now()}`,
      title: a.title ?? "Untitled",
      description: a.description ?? "",
      category: classifyCategory(text),
      severity: classifySeverity(text),
      country: detectCountry(text),
      source: a.source?.name ?? "GNews",
      url: a.url,
      imageUrl: a.image,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      isLive: true,
    } as IntelligenceItem;
  });
}

function normalizeNewsAPI(articles: any[]): IntelligenceItem[] {
  return articles.map((a, i) => {
    const text = `${a.title ?? ""} ${a.description ?? ""}`;
    return {
      id: a.url ?? `na-${i}`,
      title: a.title ?? "Untitled",
      description: a.description ?? "",
      category: classifyCategory(text),
      severity: classifySeverity(text),
      country: detectCountry(text),
      source: a.source?.name ?? "NewsAPI",
      url: a.url,
      imageUrl: a.urlToImage,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      isLive: true,
    } as IntelligenceItem;
  });
}

export interface FetchOpts {
  category?: typeof GNEWS_CATEGORIES[number];
  query?: string;
  max?: number;
  lang?: string;
  /** Force a network fetch and ignore the cache. */
  force?: boolean;
}

function cacheKeyFor(opts: FetchOpts): string {
  return `${opts.query ?? ""}|${opts.category ?? "world"}|${opts.lang ?? "en"}|${opts.max ?? 25}`;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch { return null; }
}

function writeCache(entry: CacheEntry) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch {}
}

/** In-flight de-duplication so parallel pages share one network call. */
const inflight = new Map<string, Promise<NewsResult>>();

export async function fetchIntelligence(opts: FetchOpts = {}): Promise<NewsResult> {
  const key = cacheKeyFor(opts);

  // 1) Serve fresh cache (<10min) unless caller forced a refresh.
  if (!opts.force) {
    const cached = readCache();
    if (cached && cached.key === key && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        items: cached.items,
        status: "cached",
        cachedAt: cached.timestamp,
        message: `Cached live data from ${new Date(cached.timestamp).toLocaleTimeString()}`,
      };
    }
  }

  // 2) Deduplicate concurrent fetches with the same key.
  if (inflight.has(key)) return inflight.get(key)!;

  const p = doFetch(opts, key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function doFetch(opts: FetchOpts, key: string): Promise<NewsResult> {
  const { category = "world", query, max = 25, lang = "en" } = opts;

  // GNews
  if (GNEWS_KEY) {
    try {
      const params = new URLSearchParams({ lang, max: String(max), apikey: GNEWS_KEY });
      if (query) params.set("q", query); else params.set("category", category);
      const url = `https://gnews.io/api/v4/${query ? "search" : "top-headlines"}?${params}`;
      const res = await fetch(url);

      if (res.status === 429) {
        // Rate limited — fall back to cache, then demo. Do NOT auto-retry.
        const cached = readCache();
        if (cached && cached.key === key) {
          return {
            items: cached.items,
            status: "rate_limited",
            cachedAt: cached.timestamp,
            message: "GNews rate limit reached. Showing cached live data.",
          };
        }
        return {
          items: demoNews,
          status: "rate_limited",
          message: "GNews rate limit reached. Showing demo data.",
        };
      }

      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j?.errors?.[0] ?? j?.message ?? ""; } catch {}
        throw new Error(`GNews ${res.status}${detail ? ` — ${detail}` : ""}`);
      }
      const data = await res.json();
      const items = normalizeGNews(data.articles ?? []);
      const ts = Date.now();
      writeCache({ items, timestamp: ts, key });
      return { items, status: "live", cachedAt: ts };
    } catch (e: any) {
      const raw = e?.message ?? String(e);
      const safe = raw.replace(GNEWS_KEY, "***");

      // Try NewsAPI fallback only if explicitly configured
      if (NEWS_API_KEY) {
        const r = await tryNewsApi(opts, key);
        if (r) return r;
      }

      // Otherwise fall back to cache, then demo
      const cached = readCache();
      if (cached && cached.key === key) {
        return {
          items: cached.items,
          status: "cached",
          cachedAt: cached.timestamp,
          message: `GNews unreachable — showing cached data from ${new Date(cached.timestamp).toLocaleTimeString()}`,
        };
      }
      const friendly = /Failed to fetch|NetworkError/i.test(safe)
        ? "Could not reach gnews.io (network blocked, ad-blocker, or CORS). Showing demo data."
        : `GNews error: ${safe}. Showing demo data.`;
      console.warn("GNews failed", e);
      return { items: demoNews, status: "error", message: friendly };
    }
  }

  if (NEWS_API_KEY) {
    const r = await tryNewsApi(opts, key);
    if (r) return r;
  }

  return {
    items: demoNews,
    status: "demo",
    message: "No news API key configured (set VITE_GNEWS_API_KEY) — showing demo intelligence feed.",
  };
}

async function tryNewsApi(opts: FetchOpts, key: string): Promise<NewsResult | null> {
  if (!NEWS_API_KEY) return null;
  const { category = "world", query, max = 25, lang = "en" } = opts;
  try {
    const params = new URLSearchParams({ language: lang, pageSize: String(max), apiKey: NEWS_API_KEY });
    if (query) params.set("q", query);
    else params.set("category", category === "world" || category === "nation" ? "general" : category);
    const url = `https://newsapi.org/v2/${query ? "everything" : "top-headlines"}?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const data = await res.json();
    const items = normalizeNewsAPI(data.articles ?? []);
    const ts = Date.now();
    writeCache({ items, timestamp: ts, key });
    return { items, status: "live", cachedAt: ts };
  } catch {
    return null;
  }
}

export function isNewsConfigured(): boolean {
  return Boolean(GNEWS_KEY || NEWS_API_KEY);
}

/** Clear cached news (e.g. on a hard refresh). */
export function clearNewsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
