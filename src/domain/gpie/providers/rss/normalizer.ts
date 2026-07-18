/**
 * Trusted-broadcaster RSS item → GlobalEvent.
 *
 * Items arrive pre-parsed from `/api/public/rss-proxy` (see `parseRssXml`)
 * as `{ title, link, description?, pubDate? }`. No geocoding is provided by
 * any broadcaster feed, so — exactly like GDELT — we plot at a best-effort
 * country centroid detected from the headline/description text.
 */
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";
import { getCountryCentroid } from "@/domain/utils/countryCentroids";
import { classifyCategory, classifySeverity, detectCountry } from "@/services/newsApi";
import type { ParsedRssItem } from "@/routes/api/public/rss-proxy";

export function normalizeRssItem(item: ParsedRssItem, sourceId: string, sourceLabel: string): GlobalEvent | null {
  if (!item.title || !item.link) return null;

  const text = `${item.title} ${item.description ?? ""}`;
  const category = classifyCategory(text);
  const severity = classifySeverity(text);
  const country = detectCountry(text);
  const coordinates = getCountryCentroid(country);

  return createGlobalEvent({
    id: `rss-${sourceId}-${hashUrl(item.link)}`,
    title: item.title,
    description: item.description,
    category,
    severity,
    source: sourceLabel,
    sourceUrl: item.link,
    provider: "rss",
    country,
    locationName: country,
    coordinates,
    timestamp: toIsoOrNow(item.pubDate),
    tags: tokenize(`${item.title} ${category} ${sourceLabel}`).slice(0, 6),
    status: "live",
    live: true,
    verified: true, // editorially curated broadcaster content
    metadata: { rssSource: sourceId, approximateLocation: Boolean(coordinates) },
  });
}

export function normalizeRssBatch(items: ParsedRssItem[], sourceId: string, sourceLabel: string): GlobalEvent[] {
  return items
    .map((item) => normalizeRssItem(item, sourceId, sourceLabel))
    .filter((e): e is GlobalEvent => e !== null);
}

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
