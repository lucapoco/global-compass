import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side RSS aggregator proxy for trusted international broadcasters.
 *
 * RSS feeds virtually never send browser-friendly CORS headers, so every
 * feed is fetched server-side and parsed into a small, uniform JSON shape.
 *
 * Sources covered: BBC World, Al Jazeera, The Guardian World, DW (Deutsche
 * Welle) World, France 24, Sky News World, NHK World-Japan.
 *
 * Reuters and AP are intentionally NOT included — neither currently
 * publishes a stable, free public RSS feed (Reuters retired its public
 * feeds; AP syndicates only through paid partners). Including a feed that
 * silently breaks would violate the "never fake data" principle, so we
 * only wire sources with a verified, currently-working public feed.
 *
 * No XML parsing dependency is added — RSS 2.0 / Atom <item>/<entry> blocks
 * are simple enough to parse defensively with regex; any malformed feed
 * degrades to an empty list rather than throwing.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const RSS_SOURCES: Record<string, { label: string; url: string }> = {
  bbc:        { label: "BBC News",        url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  aljazeera:  { label: "Al Jazeera",      url: "https://www.aljazeera.com/xml/rss/all.xml" },
  guardian:   { label: "The Guardian",    url: "https://www.theguardian.com/world/rss" },
  dw:         { label: "DW",              url: "https://rss.dw.com/rdf/rss-en-world" },
  france24:   { label: "France 24",       url: "https://www.france24.com/en/rss" },
  skynews:    { label: "Sky News",        url: "https://feeds.skynews.com/feeds/rss/world.xml" },
  nhk:        { label: "NHK World",       url: "https://www3.nhk.or.jp/nhkworld/en/news/all.xml" },
};

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}
const cacheBySource = new Map<string, CacheEntry>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ─── Minimal, defensive RSS/Atom parser (no dependency) ────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : undefined;
}

function extractAtomLink(block: string): string | undefined {
  const match = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return match?.[1];
}

export interface ParsedRssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
}

export function parseRssXml(xml: string, maxItems = 40): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractAtomLink(block);
    const description = extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated") || extractTag(block, "dc:date");

    if (title && link) {
      items.push({ title, link, description: description?.slice(0, 400), pubDate });
    }
  }
  return items;
}

export const Route = createFileRoute("/api/public/rss-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sourceId = (url.searchParams.get("source") ?? "").toLowerCase();

        if (sourceId === "list") {
          return json({
            ok: true,
            sources: Object.entries(RSS_SOURCES).map(([id, s]) => ({ id, label: s.label })),
          });
        }

        const source = RSS_SOURCES[sourceId];
        if (!source) {
          return json(
            { ok: false, error: "unknown_source", message: `Unknown RSS source "${sourceId}". Use ?source=list to see options.` },
            400,
          );
        }

        const cached = cacheBySource.get(sourceId);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, source: sourceId, label: source.label, items: cached.data, freshness: "cached", fetchedAt: cached.fetchedAt });
        }

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8_000);
          const res = await fetch(source.url, {
            signal: controller.signal,
            headers: { "User-Agent": "GlobalPulse/1.0 (+educational intelligence platform)", Accept: "application/rss+xml, application/xml, text/xml" },
          });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`${source.label} feed responded ${res.status}`);
          const xml = await res.text();
          const items = parseRssXml(xml);

          cacheBySource.set(sourceId, { data: items, fetchedAt: Date.now() });
          return json({ ok: true, source: sourceId, label: source.label, items, freshness: "live", fetchedAt: Date.now() });
        } catch (e) {
          if (cached) {
            return json({ ok: true, source: sourceId, label: source.label, items: cached.data, freshness: "cached", fetchedAt: cached.fetchedAt });
          }
          const message = e instanceof Error ? e.message : String(e);
          return json({ ok: false, error: "network_error", message }, 502);
        }
      },
    },
  },
});
