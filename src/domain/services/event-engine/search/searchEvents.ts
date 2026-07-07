import type { GlobalEvent } from "@/domain/models/GlobalEvent";

/**
 * Unified search over GlobalEvent — country, city, title, tags, provider, category.
 * Title matches rank highest, then country/tags, then everything else; ties break on riskScore.
 */
export function searchEvents(events: GlobalEvent[], query: string): GlobalEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;

  const scored: { event: GlobalEvent; score: number }[] = [];

  for (const event of events) {
    let score = 0;
    if (event.title.toLowerCase().includes(q)) score += 4;
    if (event.country?.toLowerCase().includes(q)) score += 3;
    if (event.locationName?.toLowerCase().includes(q)) score += 3;
    if (event.tags.some((t) => t.toLowerCase().includes(q))) score += 2;
    if (event.category.toLowerCase().includes(q)) score += 2;
    if (event.provider.toLowerCase().includes(q)) score += 1;
    if (event.source.toLowerCase().includes(q)) score += 1;
    if (event.description?.toLowerCase().includes(q)) score += 1;

    if (score > 0) scored.push({ event, score });
  }

  return scored.sort((a, b) => b.score - a.score || b.event.riskScore - a.event.riskScore).map((s) => s.event);
}
