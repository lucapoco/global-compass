import type { IntelligenceItem, IntelligenceCategory, IntelligenceSeverity } from "@/types";
import { fallbackNews } from "@/data/fallbackNews";

/**
 * Serviciu centralizat GNews (doar prin proxy same-origin `/api/public/gnews-proxy`).
 *
 * - Un Promise în zbor unifică apelurile concurrente.
 * - Cache localStorage (30 min; refresh manual ocolește citirea cache via `force`).
 * - Lock rate-limit 30 min după 429/403 upstream.
 * - ≥3 s între apeluri reale de proxy la merge pe categorii.
 * - Deduplicare după URL / titlu; sortare descrescătoare după dată.
 */

const PROXY_URL = "/api/public/gnews-proxy";
const NEWSAPI_PROXY_URL = "/api/public/newsapi-proxy";

/** Current cache blob (v4). Legacy key migrated on read. */
const CACHE_KEY = "global_pulse_gnews_cache_v4";
const LEGACY_CACHE_KEY = "global_pulse_gnews_cache";
const CACHE_TS_KEY = "global_pulse_gnews_cache_timestamp_v4";
const LEGACY_CACHE_TS_KEY = "global_pulse_gnews_cache_timestamp";
const RATE_LIMIT_KEY = "global_pulse_gnews_rate_limit_until";
const LAST_REQ_KEY = "global_pulse_gnews_last_request_at";
const NEWS_DEBUG_EVENT = "global-pulse-gnews-debug";

const CACHE_TTL_MS = 30 * 60 * 1000;
const RATE_LIMIT_MS = 30 * 60 * 1000;
const MIN_INTERVAL_MS = 3 * 1000;

const log = (..._a: unknown[]) => {
  /* fără console în producție — starea de debug e în DevConsole */
};

export type NewsStatus = "live" | "cached" | "demo" | "error" | "rate_limited";
export type NewsSource = "GNews" | "NewsAPI" | "Cache" | "Demo";
export type NewsDebugStatus = NewsStatus | "idle";

export interface NewsResult {
  items: IntelligenceItem[];
  status: NewsStatus;
  source: NewsSource;
  errorMessage?: string;
  message?: string;
  lastUpdated?: string;
  cachedAt?: number;
  /** Deduped pool size before applying caller `limit` / search slice. */
  fetchedTotal?: number;
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

const CATEGORY_RULES: Array<[IntelligenceCategory, RegExp]> = [
  ["military", /\b(war|missile|attack|troops?|military|defense|invasion|airstrike|army|nato|navy)\b/i],
  ["geopolitics", /\b(election|government|president|border|diplomacy|sanctions?|treaty|summit|parliament|prime minister)\b/i],
  ["economy", /\b(stock|inflation|markets?|economy|bank|oil|gas|gdp|recession|tariff|currency|trade)\b/i],
  ["cyber", /\b(cyber|hack(ed|ing)?|malware|ransomware|breach|phishing|exploit)\b/i],
  ["disaster", /\b(earthquake|flood|wildfire|storm|hurricane|tsunami|disaster|tornado|landslide)\b/i],
  ["climate", /\b(climate|heatwave|emissions|temperature|drought|warming|carbon)\b/i],
  ["technology", /\b(\bai\b|chip|software|technology|startup|robot|silicon|semiconductor|data center)\b/i],
  ["energy", /\b(energy|nuclear|reactor|pipeline|grid|electricity|solar|wind farm)\b/i],
  ["health", /\b(virus|disease|hospital|health|outbreak|pandemic|vaccine)\b/i],
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
  "United States",
  "USA",
  "UK",
  "United Kingdom",
  "China",
  "Russia",
  "Ukraine",
  "Israel",
  "Palestine",
  "Gaza",
  "Iran",
  "Iraq",
  "Syria",
  "Turkey",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Romania",
  "Poland",
  "Japan",
  "India",
  "Pakistan",
  "Brazil",
  "Mexico",
  "Canada",
  "Australia",
  "South Korea",
  "North Korea",
  "Saudi Arabia",
  "Egypt",
  "Greece",
  "Sweden",
  "Norway",
  "Finland",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Argentina",
  "Chile",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Ethiopia",
  "Indonesia",
  "Vietnam",
  "Thailand",
  "Philippines",
  "Singapore",
  "Hungary",
  "Czech",
  "Bulgaria",
  "Portugal",
  "Ireland",
  "Denmark",
];
export function detectCountry(text: string): string | undefined {
  for (const c of COUNTRY_LIST) if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  return undefined;
}

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, "")
    .slice(0, 140);
}

/** Dedupe by URL, else by normalized title (near-identical titles collapse). */
export function dedupeIntelligenceItems(items: IntelligenceItem[]): IntelligenceItem[] {
  const out: IntelligenceItem[] = [];
  const byUrl = new Map<string, IntelligenceItem>();
  const byTitle = new Map<string, IntelligenceItem>();
  for (const item of items) {
    const url = item.url?.trim();
    if (url) {
      if (!byUrl.has(url)) {
        byUrl.set(url, item);
        out.push(item);
      }
      continue;
    }
    const tk = normalizeTitleKey(item.title);
    if (!tk) {
      out.push(item);
      continue;
    }
    if (byTitle.has(tk)) continue;
    byTitle.set(tk, item);
    out.push(item);
  }
  return out;
}

export function sortIntelligenceByPublishedDesc(items: IntelligenceItem[]): IntelligenceItem[] {
  return [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

const SEVERITY_ORDER: Record<IntelligenceSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type IntelligenceSortMode = "newest" | "severity" | "source" | "category";

export function sortIntelligenceItems(items: IntelligenceItem[], mode: IntelligenceSortMode): IntelligenceItem[] {
  const copy = [...items];
  switch (mode) {
    case "severity":
      return copy.sort((a, b) => {
        const d = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (d !== 0) return d;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    case "source":
      return copy.sort((a, b) => a.source.localeCompare(b.source) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    case "category":
      return copy.sort((a, b) => a.category.localeCompare(b.category) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    default:
      return sortIntelligenceByPublishedDesc(copy);
  }
}

function normalizeGNews(articles: unknown[]): IntelligenceItem[] {
  if (!Array.isArray(articles)) return [];
  return articles.map((raw, i) => {
    const a = raw as Record<string, unknown>;
    const src = a.source as Record<string, unknown> | undefined;
    const text = `${a.title ?? ""} ${a.description ?? ""}`;
    return {
      id: String(a.url ?? `gn-${i}-${a.publishedAt ?? Date.now()}`),
      title: String(a.title ?? "Untitled"),
      description: String(a.description ?? ""),
      category: classifyCategory(text),
      severity: classifySeverity(text),
      country: detectCountry(text),
      source: String(src?.name ?? "GNews"),
      url: a.url ? String(a.url) : undefined,
      imageUrl: a.image ? String(a.image) : undefined,
      publishedAt: String(a.publishedAt ?? new Date().toISOString()),
      isLive: true,
    } satisfies IntelligenceItem;
  });
}

function stampIsLive(items: IntelligenceItem[], status: NewsStatus): IntelligenceItem[] {
  const live = status === "live";
  return items.map((i) => ({ ...i, isLive: live }));
}

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

function readCachedItems(): IntelligenceItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY) ?? localStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntelligenceItem[];
  } catch {
    return null;
  }
}

function readCacheTimestamp(): number {
  const v4 = readNum(CACHE_TS_KEY);
  if (v4) return v4;
  return readNum(LEGACY_CACHE_TS_KEY);
}

function writeCache(items: IntelligenceItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_TS_KEY);
  } catch {
    /* ignore */
  }
}

function cacheTs(): number {
  return readCacheTimestamp();
}
function rateLimitUntil(): number {
  return readNum(RATE_LIMIT_KEY);
}
function setRateLimit(ms = RATE_LIMIT_MS) {
  writeNum(RATE_LIMIT_KEY, Date.now() + ms);
}
function lastRequestAt(): number {
  return readNum(LAST_REQ_KEY);
}
function markRequest() {
  writeNum(LAST_REQ_KEY, Date.now());
}

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
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NEWS_DEBUG_EVENT, { detail: getNewsDebugSnapshot() }));
}

export function subscribeNewsDebug(listener: (snapshot: NewsDebugSnapshot) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(getNewsDebugSnapshot());
  window.addEventListener(NEWS_DEBUG_EVENT, handler);
  listener(getNewsDebugSnapshot());
  return () => window.removeEventListener(NEWS_DEBUG_EVENT, handler);
}

export interface FetchIntelligenceOptions {
  /** Preferred: max items to return after dedupe + filter (cap 50). */
  limit?: number;
  /** @deprecated use `limit` — kept for back-compat */
  max?: number;
  /** Client-side filter on title, description, source, country, category (case-insensitive). */
  query?: string;
  /** Bypass disk + short in-memory reuse to force a new upstream attempt (still respects rate lock). */
  force?: boolean;
  /** Alias of `force` (manual refresh). */
  refresh?: boolean;
  /** Health probe: small network target, no multi-category merge. */
  probe?: boolean;
  /** Reserved for future server-side category hints. */
  categories?: string[];
}

let activeRequest: Promise<NewsResult> | null = null;
/** Health checks must not share `activeRequest` or `rememberResult` with the main feed. */
let activeProbeRequest: Promise<NewsResult> | null = null;

function requestedLimit(opts: FetchIntelligenceOptions): number {
  const n = opts.limit ?? opts.max ?? 25;
  return Math.min(50, Math.max(1, n));
}

/** How many articles we try to assemble upstream before dedupe + caller slice. */
function networkAssemblyTarget(opts: FetchIntelligenceOptions): number {
  if (opts.probe) return Math.min(10, requestedLimit(opts));
  const req = requestedLimit(opts);
  return Math.min(50, Math.max(30, req));
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchProxyHeadlinesOnce(params: {
  max: number;
  category: string;
  lang?: string;
  country?: string;
  q?: string;
}): Promise<{ status: number; articles: unknown[]; json?: Record<string, unknown> }> {
  const sp = new URLSearchParams({
    category: params.category,
    lang: params.lang ?? "en",
    country: params.country ?? "us",
    max: String(Math.min(50, Math.max(1, params.max))),
  });
  if (params.q?.trim()) sp.set("q", params.q.trim().slice(0, 200));
  const url = `${PROXY_URL}?${sp.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  let json: Record<string, unknown> | undefined;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const articles = (json?.articles as unknown[]) ?? [];
  return { status: res.status, articles, json };
}

/**
 * GNews categories we rotate through when a single request returns fewer articles
 * than requested. Invalid categories are skipped on non-OK responses.
 */
const MERGE_CATEGORIES = ["general", "world", "business", "technology", "science", "health"] as const;

async function assembleFromProxy(
  target: number,
  options: { probe?: boolean; serverQ?: string } = {},
): Promise<{
  items: IntelligenceItem[];
  hit429: boolean;
  hit403: boolean;
  hit401: boolean;
  networkError: boolean;
  lastDetail?: string;
}> {
  const collected: IntelligenceItem[] = [];
  let hit429 = false;
  let hit403 = false;
  let hit401 = false;
  let networkError = false;
  let lastDetail: string | undefined;

  /** API health: one request only (no category rotation). */
  if (options.probe) {
    markRequest();
    sessionGNewsCalls += 1;
    emitDebugUpdate();
    try {
      const row = await fetchProxyHeadlinesOnce({
        max: Math.min(10, target),
        category: "general",
        q: options.serverQ,
      });
      if (row.status === 429) hit429 = true;
      else if (row.status === 403) hit403 = true;
      else if (row.status === 401) hit401 = true;
      else if (!row.status || row.status >= 400) {
        lastDetail =
          (row.json?.message as string) || (row.json?.error as string) || `HTTP ${row.status}`;
      } else {
        collected.push(...normalizeGNews(row.articles));
      }
    } catch (e) {
      networkError = true;
      lastDetail = e instanceof Error ? e.message : String(e);
    }
    return {
      items: sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(collected)),
      hit429,
      hit403,
      hit401,
      networkError,
      lastDetail,
    };
  }

  for (let ci = 0; ci < MERGE_CATEGORIES.length; ci++) {
    const category = MERGE_CATEGORIES[ci];
    if (ci > 0) await delay(MIN_INTERVAL_MS);
    markRequest();
    sessionGNewsCalls += 1;
    emitDebugUpdate();

    let row: { status: number; articles: unknown[]; json?: Record<string, unknown> };
    try {
      row = await fetchProxyHeadlinesOnce({
        max: Math.min(10, target),
        category,
        q: options.serverQ,
      });
    } catch (e) {
      networkError = true;
      lastDetail = e instanceof Error ? e.message : String(e);
      break;
    }

    if (row.status === 429) {
      hit429 = true;
      break;
    }
    if (row.status === 403) {
      hit403 = true;
      break;
    }
    if (row.status === 401) {
      hit401 = true;
      break;
    }
    if (!row.status || row.status >= 400) {
      lastDetail =
        (row.json?.message as string) ||
        (row.json?.error as string) ||
        `HTTP ${row.status}`;
      continue;
    }

    collected.push(...normalizeGNews(row.articles));
    const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(collected));
    if (deduped.length >= target) {
      return { items: deduped.slice(0, target), hit429, hit403, hit401, networkError, lastDetail };
    }
  }

  return {
    items: sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(collected)),
    hit429,
    hit403,
    hit401,
    networkError,
    lastDetail,
  };
}

async function doHeadlinesFetch(
  networkTarget: number,
  options: { probe?: boolean },
): Promise<NewsResult> {
  const { items, hit429, hit403, hit401, networkError, lastDetail } = await assembleFromProxy(networkTarget, {
    probe: options.probe,
  });

  if (hit429) {
    setRateLimit();
    log("GNews 429 — rate limit lock");
    return fallbackWhenBlocked(
      "GNews rate limit reached. Using cached/demo data for now.",
      "rate_limited",
      networkTarget,
    );
  }
  if (hit403) {
    setRateLimit();
    return fallbackWhenBlocked("GNews daily quota reached.", "rate_limited", networkTarget);
  }
  if (hit401) {
    return {
      items: stampIsLive(fallbackNews.slice(0, networkTarget), "error"),
      status: "error",
      source: "Demo",
      message: "GNews API key is invalid or missing.",
      errorMessage: "GNews API key is invalid or missing.",
      fetchedTotal: fallbackNews.length,
    };
  }

  if (items.length > 0) {
    if (!options.probe) {
      writeCache(items);
    }
    const ts = Date.now();
    log("GNews proxy ok", { count: items.length, target: networkTarget });
    return {
      items: stampIsLive(items, "live"),
      status: "live",
      source: "GNews",
      cachedAt: ts,
      lastUpdated: new Date(ts).toISOString(),
      fetchedTotal: items.length,
    };
  }

  if (networkError) {
    log("GNews network", lastDetail);
  }

  if (!options.probe) {
    try {
      const r = await tryNewsApi(networkTarget);
      if (r) return r;
    } catch {
      /* fall through */
    }
  }

  const cached = readCachedItems();
  if (cached?.length) {
    const deduped = stampIsLive(sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(cached)), "cached");
    return {
      items: deduped,
      status: "cached",
      source: "Cache",
      cachedAt: cacheTs(),
      lastUpdated: new Date(cacheTs()).toISOString(),
      message: `GNews unreachable — showing cached data from ${new Date(cacheTs()).toLocaleTimeString()}`,
      fetchedTotal: deduped.length,
    };
  }
  const friendly = networkError
    ? `Could not reach the GNews proxy${lastDetail ? `: ${lastDetail}` : ""}. Showing demo data.`
    : "No articles returned. Showing demo data.";
  const demo = stampIsLive(sortIntelligenceByPublishedDesc(dedupeIntelligenceItems([...fallbackNews])), "demo");
  return {
    items: demo,
    status: "error",
    source: "Demo",
    message: friendly,
    errorMessage: friendly,
    fetchedTotal: demo.length,
  };
}

async function tryNewsApi(networkTarget: number): Promise<NewsResult | null> {
  try {
    const res = await fetch(`${NEWSAPI_PROXY_URL}?pageSize=${Math.min(100, networkTarget)}`);
    const data = (await res.json()) as { articles?: unknown[]; error?: string };
    if (data.error === "not_configured" || !res.ok) return null; // no key configured — skip this fallback silently
    const items = (data.articles ?? []).map((raw, i) => {
      const a = raw as Record<string, unknown>;
      const s = a.source as Record<string, unknown> | undefined;
      const text = `${a.title ?? ""} ${a.description ?? ""}`;
      return {
        id: String(a.url ?? `na-${i}`),
        title: String(a.title ?? "Untitled"),
        description: String(a.description ?? ""),
        category: classifyCategory(text),
        severity: classifySeverity(text),
        country: detectCountry(text),
        source: String(s?.name ?? "NewsAPI"),
        url: a.url ? String(a.url) : undefined,
        imageUrl: a.urlToImage ? String(a.urlToImage) : undefined,
        publishedAt: String(a.publishedAt ?? new Date().toISOString()),
        isLive: true,
      } satisfies IntelligenceItem;
    });
    const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(items)).slice(0, networkTarget);
    writeCache(deduped);
    const ts = Date.now();
    return {
      items: stampIsLive(deduped, "live"),
      status: "live",
      source: "NewsAPI",
      cachedAt: ts,
      lastUpdated: new Date(ts).toISOString(),
      fetchedTotal: deduped.length,
    };
  } catch {
    return null;
  }
}

export async function fetchIntelligence(opts: FetchIntelligenceOptions = {}): Promise<NewsResult> {
  const force = Boolean(opts.force || opts.refresh);
  const normalizedQuery = opts.query?.trim().toLowerCase() ?? "";
  const max = requestedLimit(opts);
  const networkTarget = networkAssemblyTarget(opts);

  if (opts.probe) {
    if (activeProbeRequest) {
      const r = await activeProbeRequest;
      return applyQueryAndLimit(r, normalizedQuery, max);
    }
    activeProbeRequest = (async (): Promise<NewsResult> => {
      const rlUntil = rateLimitUntil();
      if (Date.now() < rlUntil) {
        const ts = cacheTs();
        const cached = readCachedItems();
        if (cached?.length) {
          const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(cached));
          return {
            items: stampIsLive(deduped, "rate_limited"),
            status: "rate_limited",
            source: "Cache",
            cachedAt: ts,
            lastUpdated: new Date(ts).toISOString(),
            message: "GNews rate limit lock — showing cached items for probe.",
            fetchedTotal: deduped.length,
          };
        }
        const demo = stampIsLive(sortIntelligenceByPublishedDesc(dedupeIntelligenceItems([...fallbackNews])), "demo");
        return {
          items: demo,
          status: "rate_limited",
          source: "Demo",
          message: "GNews rate limit lock active.",
          fetchedTotal: demo.length,
        };
      }
      const sinceLast = Date.now() - lastRequestAt();
      if (sinceLast < MIN_INTERVAL_MS && !force) {
        const ts = cacheTs();
        const cached = readCachedItems();
        if (cached?.length) {
          const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(cached));
          return {
            items: stampIsLive(deduped, "cached"),
            status: "cached",
            source: "Cache",
            cachedAt: ts,
            lastUpdated: new Date(ts).toISOString(),
            fetchedTotal: deduped.length,
          };
        }
      }
      return doHeadlinesFetch(networkTarget, { probe: true });
    })().finally(() => {
      activeProbeRequest = null;
    });
    const pr = await activeProbeRequest;
    return applyQueryAndLimit(pr, normalizedQuery, max);
  }

  if (!force && lastSharedResult && Date.now() - lastSharedResultAt < CACHE_TTL_MS) {
    log("shared in-memory hit", { ageMs: Date.now() - lastSharedResultAt });
    return applyQueryAndLimit(lastSharedResult, normalizedQuery, max);
  }

  if (activeRequest) {
    log("joining in-flight request");
    const r = await activeRequest;
    return applyQueryAndLimit(r, normalizedQuery, max);
  }

  if (!force) {
    const ts = cacheTs();
    const cached = readCachedItems();
    if (cached && ts && Date.now() - ts < CACHE_TTL_MS) {
      log("cache hit", { ageMs: Date.now() - ts });
      const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(cached));
      const result = rememberResult({
        items: stampIsLive(deduped, "cached"),
        status: "cached",
        source: "Cache",
        cachedAt: ts,
        lastUpdated: new Date(ts).toISOString(),
        message: `Cached live data from ${new Date(ts).toLocaleTimeString()}`,
        fetchedTotal: deduped.length,
      });
      return applyQueryAndLimit(result, normalizedQuery, max);
    }
  }

  const rlUntil = rateLimitUntil();
  if (Date.now() < rlUntil) {
    log("rate-limit lock active", { until: new Date(rlUntil).toISOString() });
    return applyQueryAndLimit(
      fallbackWhenBlocked("GNews rate limit reached. Using cached/demo data for now.", "rate_limited", networkTarget),
      normalizedQuery,
      max,
    );
  }

  const sinceLast = Date.now() - lastRequestAt();
  if (sinceLast < MIN_INTERVAL_MS && !force) {
    log("min-interval guard", { sinceLast });
    return applyQueryAndLimit(fallbackWhenBlocked(undefined, "cached", networkTarget), normalizedQuery, max);
  }

  activeRequest = doHeadlinesFetch(networkTarget, { probe: false }).then(rememberResult).finally(() => {
      activeRequest = null;
    });
  const result = await activeRequest;
  return applyQueryAndLimit(result, normalizedQuery, max);
}

function applyQueryAndLimit(result: NewsResult, query: string, max: number): NewsResult {
  const q = query.trim().toLowerCase();
  const pool = result.items;
  const fetchedTotal = result.fetchedTotal ?? pool.length;
  const items = q
    ? pool.filter((item) =>
        [item.title, item.description, item.source, item.country, item.category, item.severity]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : pool;
  return { ...result, items: items.slice(0, max), fetchedTotal };
}

function fallbackWhenBlocked(msg: string | undefined, status: NewsStatus, poolCap: number): NewsResult {
  const cached = readCachedItems();
  if (cached?.length) {
    const deduped = sortIntelligenceByPublishedDesc(dedupeIntelligenceItems(cached));
    const result = rememberResult({
      items: stampIsLive(deduped, status === "rate_limited" ? "rate_limited" : "cached"),
      status: status === "rate_limited" ? "rate_limited" : "cached",
      source: "Cache",
      cachedAt: cacheTs(),
      lastUpdated: new Date(cacheTs()).toISOString(),
      message: msg,
      errorMessage: status === "rate_limited" ? msg : undefined,
      fetchedTotal: deduped.length,
    });
    return { ...result, items: result.items.slice(0, poolCap) };
  }
  const demo = stampIsLive(sortIntelligenceByPublishedDesc(dedupeIntelligenceItems([...fallbackNews])), "demo");
  const result = rememberResult({
    items: demo,
    status: status === "rate_limited" ? "rate_limited" : "demo",
    source: "Demo",
    message: msg ?? "Showing demo data.",
    errorMessage: status === "rate_limited" ? msg : undefined,
    fetchedTotal: demo.length,
  });
  return { ...result, items: result.items.slice(0, poolCap) };
}

export function isNewsConfigured(): boolean {
  return true;
}

export function clearNewsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_TS_KEY);
    localStorage.removeItem(RATE_LIMIT_KEY);
    localStorage.removeItem(LAST_REQ_KEY);
  } catch {
    /* ignore */
  }
  activeRequest = null;
  activeProbeRequest = null;
  lastSharedResult = null;
  lastSharedResultAt = 0;
  emitDebugUpdate();
}

/** @deprecated use FetchIntelligenceOptions */
export type FetchOpts = FetchIntelligenceOptions;
