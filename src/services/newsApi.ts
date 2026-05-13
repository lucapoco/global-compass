import type { IntelligenceItem, IntelligenceCategory, IntelligenceSeverity } from "@/types";
import { demoNews } from "@/data/demoNews";

/**
 * Centralized GNews service.
 *
 * GNews free tier is very strict:
 *   - 1 request per second
 *   - limited daily quota (403 when exceeded)
 *   - 429 when bursting too fast
 *
 * To survive a live demo we make as few network requests as possible:
 *   1. ONE shared fetch — Dashboard, Intelligence Feed, Alerts, Map, Risk
 *      index all share the same in-memory promise + localStorage cache.
 *   2. 30 min localStorage cache.
 *   3. 30 min rate-limit lock when GNews returns 429.
 *   4. 3 s minimum interval between two real API calls.
 *   5. Singleton in-flight lock so React StrictMode double-effects do not
 *      create two simultaneous requests.
 *
 * Only this file is allowed to talk to gnews.io. Every page imports
 * `fetchIntelligence()` — never call the API directly elsewhere.
 */

/**
 * IMPORTANT: The browser never talks to gnews.io directly anymore. All GNews
 * traffic goes through our same-origin server route /api/public/gnews-proxy
 * which holds the API key server-side. This avoids ad-blockers, CORS issues,
 * and key leaks. See src/routes/api/public/gnews-proxy.ts.
 */
const PROXY_URL = "/api/public/gnews-proxy";
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY as string | undefined;

const CACHE_KEY = "global_pulse_gnews_cache";
const CACHE_TS_KEY = "global_pulse_gnews_cache_timestamp";
const RATE_LIMIT_KEY = "global_pulse_gnews_rate_limit_until";
const LAST_REQ_KEY = "global_pulse_gnews_last_request_at";
export const NEWS_DEBUG_EVENT = "global-pulse-gnews-debug";

const CACHE_TTL_MS = 30 * 60 * 1000;      // 30 min
const RATE_LIMIT_MS = 30 * 60 * 1000;     // 30 min
const MIN_INTERVAL_MS = 3 * 1000;         // 3 s between real API hits

const DEV = !!import.meta.env.DEV;
const log = (...a: any[]) => { if (DEV) console.log("[newsApi]", ...a); };
const redactKey = (value: string) => value;

export type NewsStatus = "live" | "cached" | "demo" | "error" | "rate_limited";
export type NewsSource = "GNews" | "Cache" | "Demo";
export type NewsDebugStatus = NewsStatus | "idle";

export interface NewsResult {
  items: IntelligenceItem[];
  status: NewsStatus;
  source: NewsSource;
  /** Optional human-readable error/info text. */
  errorMessage?: string;
  /** Back-compat alias for errorMessage used by some components. */
  message?: string;
  lastUpdated?: string;
  cachedAt?: number;
}

export interface NewsDebugSnapshot {
  sessionGNewsCalls: number;
  lastRequestAt: number | null;
  currentStatus: NewsDebugStatus;
  rateLimitActive: boolean;
  rateLimitUntil: number | null;
  cacheAgeMs: number | null;
  cacheItems: number;
}

let sessionGNewsCalls = 0;
let lastSharedResult: NewsResult | null = null;
let lastSharedResultAt = 0;

// ---------- Classification (local, so we only need ONE GNews request) ----------

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
const HIGH     = /\b(crisis|warning|conflict|sanctions|cyberattack|explosion|flood|evacuat|airstrike)\b/i;
const MEDIUM   = /\b(protest|inflation|election|storm|outage|recall|strike|tension)\b/i;

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
  for (const c of COUNTRY_LIST) if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
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

// ---------- Storage helpers ----------

function readNum(key: string): number {
  try { return Number(localStorage.getItem(key) ?? 0) || 0; } catch { return 0; }
}
function writeNum(key: string, v: number) { try { localStorage.setItem(key, String(v)); } catch {} }
function readCachedItems(): IntelligenceItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntelligenceItem[];
  } catch { return null; }
}
function writeCache(items: IntelligenceItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {}
}
function cacheTs(): number { return readNum(CACHE_TS_KEY); }
function rateLimitUntil(): number { return readNum(RATE_LIMIT_KEY); }
function setRateLimit(ms = RATE_LIMIT_MS) { writeNum(RATE_LIMIT_KEY, Date.now() + ms); }
function lastRequestAt(): number { return readNum(LAST_REQ_KEY); }
function markRequest() { writeNum(LAST_REQ_KEY, Date.now()); }

function rememberResult(result: NewsResult): NewsResult {
  lastSharedResult = result;
  lastSharedResultAt = Date.now();
  emitDebugUpdate();
  return result;
}

export function getNewsDebugSnapshot(): NewsDebugSnapshot {
  const ts = cacheTs();
  const cached = readCachedItems();
  const rlUntil = rateLimitUntil();
  const lastReq = lastRequestAt();
  return {
    sessionGNewsCalls,
    lastRequestAt: lastReq || null,
    currentStatus: lastSharedResult?.status ?? "idle",
    rateLimitActive: Date.now() < rlUntil,
    rateLimitUntil: rlUntil || null,
    cacheAgeMs: cached && ts ? Date.now() - ts : null,
    cacheItems: cached?.length ?? 0,
  };
}

function emitDebugUpdate() {
  if (!DEV || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NEWS_DEBUG_EVENT, { detail: getNewsDebugSnapshot() }));
}

export function subscribeNewsDebug(listener: (snapshot: NewsDebugSnapshot) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(getNewsDebugSnapshot());
  window.addEventListener(NEWS_DEBUG_EVENT, handler);
  listener(getNewsDebugSnapshot());
  return () => window.removeEventListener(NEWS_DEBUG_EVENT, handler);
}

// ---------- Public API ----------

export interface FetchOpts {
  /** Optional local filter. It does not make a separate GNews request. */
  query?: string;
  /** Slice size; the underlying fetch is always one shared headlines call. */
  max?: number;
  /** Force a real network call (still respects the rate-limit lock). */
  force?: boolean;
}

/** Singleton in-flight promise — coalesces concurrent callers into ONE request. */
let activeRequest: Promise<NewsResult> | null = null;

export async function fetchIntelligence(opts: FetchOpts = {}): Promise<NewsResult> {
  const { query, max = 25, force = false } = opts;
  const normalizedQuery = query?.trim() ?? "";

  // Serve the newest in-memory result first so dashboard widgets mounted on the
  // same page do not each touch GNews or re-parse storage during presentations.
  if (!force && !normalizedQuery && lastSharedResult && Date.now() - lastSharedResultAt < CACHE_TTL_MS) {
    log("shared in-memory hit", { ageMs: Date.now() - lastSharedResultAt });
    return applyQueryAndLimit(lastSharedResult, normalizedQuery, max);
  }

  // Coalesce concurrent callers before any cache/lock branch so React
  // StrictMode and dashboard panels all await the same shared result.
  if (activeRequest) {
    log("joining in-flight request");
    const r = await activeRequest;
    return applyQueryAndLimit(r, normalizedQuery, max);
  }

  // Serve fresh cache unless force=true
  if (!force) {
    const ts = cacheTs();
    const cached = readCachedItems();
    if (cached && Date.now() - ts < CACHE_TTL_MS) {
      log("cache hit", { ageMs: Date.now() - ts });
      const result = rememberResult({
        items: cached,
        status: "cached",
        source: "Cache",
        cachedAt: ts,
        lastUpdated: new Date(ts).toISOString(),
        message: `Cached live data from ${new Date(ts).toLocaleTimeString()}`,
      });
      return applyQueryAndLimit(result, normalizedQuery, max);
    }
  }

  // Rate-limit lock?
  const rlUntil = rateLimitUntil();
  if (Date.now() < rlUntil) {
    log("rate-limit lock active", { until: new Date(rlUntil).toISOString() });
    return applyQueryAndLimit(fallbackWhenBlocked("GNews rate limit reached. Using cached/demo data for now.", "rate_limited", Math.max(max, 25)), normalizedQuery, max);
  }

  // Minimum interval between real API calls (handles StrictMode + concurrent mounts)
  const sinceLast = Date.now() - lastRequestAt();
  if (sinceLast < MIN_INTERVAL_MS && !force) {
    log("min-interval guard", { sinceLast });
    return applyQueryAndLimit(fallbackWhenBlocked(undefined, "cached", Math.max(max, 25)), normalizedQuery, max);
  }

  activeRequest = doHeadlinesFetch().then(rememberResult).finally(() => { activeRequest = null; });
  const result = await activeRequest;
  return applyQueryAndLimit(result, normalizedQuery, max);
}

function applyQueryAndLimit(result: NewsResult, query: string, max: number): NewsResult {
  const q = query.toLowerCase();
  const items = q
    ? result.items.filter((item) => [item.title, item.description, item.source, item.country, item.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q))
    : result.items;
  return { ...result, items: items.slice(0, max) };
}

function fallbackWhenBlocked(msg: string | undefined, status: NewsStatus, max: number): NewsResult {
  const cached = readCachedItems();
  if (cached && cached.length) {
    const result = rememberResult({
      items: cached,
      status: status === "rate_limited" ? "rate_limited" : "cached",
      source: "Cache",
      cachedAt: cacheTs(),
      lastUpdated: new Date(cacheTs()).toISOString(),
      message: msg,
      errorMessage: status === "rate_limited" ? msg : undefined,
    });
    return { ...result, items: result.items.slice(0, max) };
  }
  const result = rememberResult({
    items: demoNews,
    status: status === "rate_limited" ? "rate_limited" : "demo",
    source: "Demo",
    message: msg ?? "Showing demo data.",
    errorMessage: status === "rate_limited" ? msg : undefined,
  });
  return { ...result, items: result.items.slice(0, max) };
}

async function doHeadlinesFetch(): Promise<NewsResult> {
  markRequest();
  sessionGNewsCalls += 1;
  emitDebugUpdate();

  // Hit our same-origin server proxy. The proxy holds the API key server-side
  // and forwards a single shared "general top-headlines" request to GNews.
  // Categories/severity are classified locally so we never need extra calls.
  const params = new URLSearchParams({
    category: "general",
    lang: "en",
    country: "us",
    max: "25",
  });
  const url = `${PROXY_URL}?${params.toString()}`;
  log("GNews proxy fetch", { sessionGNewsCalls });

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (res.status === 429) {
      setRateLimit();
      log("GNews 429 — rate limit lock set for 30 min");
      return fallbackWhenBlocked("GNews rate limit reached. Using cached/demo data for now.", "rate_limited", 25);
    }
    if (res.status === 403) {
      setRateLimit();
      return fallbackWhenBlocked("GNews daily quota reached. Try again after the daily reset or use demo data.", "rate_limited", 25);
    }
    if (res.status === 401) {
      return {
        items: demoNews,
        status: "error",
        source: "Demo",
        message: "GNews API key is invalid or missing.",
        errorMessage: "GNews API key is invalid or missing.",
      };
    }
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j?.errors?.[0] ?? j?.message ?? ""; } catch {}
      throw new Error(`GNews ${res.status}${detail ? ` — ${detail}` : ""}`);
    }

    const data = await res.json();
    const items = normalizeGNews(data.articles ?? []);
    writeCache(items);
    const ts = Date.now();
    log("GNews live ok", { count: items.length });
    return {
      items,
      status: "live",
      source: "GNews",
      cachedAt: ts,
      lastUpdated: new Date(ts).toISOString(),
    };
  } catch (e: any) {
    const raw = e?.message ?? String(e);
    const safe = redactKey(raw);
    log("GNews error", safe);

    if (NEWS_API_KEY) {
      const r = await tryNewsApi();
      if (r) return r;
    }

    const cached = readCachedItems();
    if (cached && cached.length) {
      return {
        items: cached,
        status: "cached",
        source: "Cache",
        cachedAt: cacheTs(),
        message: `GNews unreachable — showing cached data from ${new Date(cacheTs()).toLocaleTimeString()}`,
      };
    }
    const friendly = /Failed to fetch|NetworkError/i.test(safe)
      ? "Could not reach the GNews proxy. Showing demo data."
      : `News proxy error: ${safe}. Showing demo data.`;
    return { items: demoNews, status: "error", source: "Demo", message: friendly, errorMessage: friendly };
  }
}

async function tryNewsApi(): Promise<NewsResult | null> {
  if (!NEWS_API_KEY) return null;
  try {
    const params = new URLSearchParams({ language: "en", pageSize: "25", category: "general", apiKey: NEWS_API_KEY });
    const res = await fetch(`https://newsapi.org/v2/top-headlines?${params}`);
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const data = await res.json();
    const items = (data.articles ?? []).map((a: any, i: number) => {
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
    writeCache(items);
    const ts = Date.now();
    return { items, status: "live", source: "GNews", cachedAt: ts, lastUpdated: new Date(ts).toISOString() };
  } catch { return null; }
}

export function isNewsConfigured(): boolean { return true; /* proxy is always reachable; server decides */ }

/** Dev helper — clears all GNews-related cache + locks. */
export function clearNewsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(RATE_LIMIT_KEY);
    localStorage.removeItem(LAST_REQ_KEY);
  } catch {}
  activeRequest = null;
  lastSharedResult = null;
  lastSharedResultAt = 0;
  emitDebugUpdate();
}
