/**
 * GDELT DOC 2.0 `artlist` article → GlobalEvent.
 *
 * Response shape: { url, url_mobile, title, seendate, socialimage, domain,
 *   language, sourcecountry }. GDELT's `seendate` uses the compact
 * `YYYYMMDDTHHMMSSZ` format (no separators) — parsed manually below.
 *
 * GDELT has no per-article geocoding in DOC 2.0 mode, so we plot articles
 * at the reporting country's centroid (best-effort, clearly marked via
 * `metadata.approximateLocation`) rather than fabricating precision.
 */
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { tokenize } from "@/domain/utils/text";
import { getCountryCentroid } from "@/domain/utils/countryCentroids";
import { classifyCategory, classifySeverity } from "@/services/newsApi";

export interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

function parseGdeltDate(seendate: string | undefined): string {
  if (!seendate) return new Date().toISOString();
  const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function normalizeGdeltArticle(article: GdeltArticle): GlobalEvent | null {
  if (!article.title || !article.url) return null;

  const text = article.title;
  const category = classifyCategory(text);
  const severity = classifySeverity(text);
  const coordinates = getCountryCentroid(article.sourcecountry);

  return createGlobalEvent({
    id: `gdelt-${hashUrl(article.url)}`,
    title: article.title,
    description: `${article.domain ?? "Unknown source"} · ${article.sourcecountry ?? "Unknown origin"}`,
    category,
    severity,
    source: article.domain ?? "GDELT",
    sourceUrl: article.url,
    provider: "gdelt",
    country: article.sourcecountry,
    locationName: article.sourcecountry,
    coordinates,
    timestamp: parseGdeltDate(article.seendate),
    image: article.socialimage,
    tags: tokenize(`${article.title} ${category}`).slice(0, 6),
    status: "live",
    live: true,
    verified: false, // GDELT is an automated aggregator, not editorially curated
    metadata: {
      domain: article.domain,
      language: article.language,
      sourceCountry: article.sourcecountry,
      approximateLocation: Boolean(coordinates),
    },
  });
}

export function normalizeGdeltBatch(articles: GdeltArticle[]): GlobalEvent[] {
  return articles.map(normalizeGdeltArticle).filter((e): e is GlobalEvent => e !== null);
}

/** Small deterministic hash so the same article URL always maps to the same event id. */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
