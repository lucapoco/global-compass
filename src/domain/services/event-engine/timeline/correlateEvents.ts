import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { haversineDistanceKm, hasCoordinates } from "@/domain/utils/geo";
import { jaccardSimilarity, tokenize } from "@/domain/utils/text";
import { hoursBetween } from "@/domain/utils/time";

export interface CorrelationOptions {
  /** Two events within this distance are considered geographically related. */
  maxDistanceKm?: number;
  /** Two events published within this many hours of each other score a timestamp point. */
  maxHoursApart?: number;
  /** Minimum keyword (title) Jaccard similarity to score a keyword point. */
  minKeywordOverlap?: number;
  /** Minimum weighted score for two events to be considered related. */
  relatedThreshold?: number;
  /** Cap on how many related events are attached per event (closest score first). */
  maxRelatedPerEvent?: number;
  /** Hard cap on events considered, to keep the O(n^2) comparison bounded. */
  maxEvents?: number;
}

const DEFAULTS: Required<CorrelationOptions> = {
  maxDistanceKm: 300,
  maxHoursApart: 48,
  minKeywordOverlap: 0.2,
  relatedThreshold: 3,
  maxRelatedPerEvent: 6,
  maxEvents: 400,
};

function correlationScore(a: GlobalEvent, b: GlobalEvent, opts: Required<CorrelationOptions>): number {
  let score = 0;

  if (hasCoordinates(a.coordinates) && hasCoordinates(b.coordinates)) {
    if (haversineDistanceKm(a.coordinates, b.coordinates) <= opts.maxDistanceKm) score += 2;
  }

  if (a.country && b.country && a.country.toLowerCase() === b.country.toLowerCase()) score += 2;

  if (a.category === b.category) score += 1;

  const overlap = jaccardSimilarity(tokenize(a.title), tokenize(b.title));
  if (overlap >= opts.minKeywordOverlap) score += 2;

  if (hoursBetween(a.timestamp, b.timestamp) <= opts.maxHoursApart) score += 1;

  return score;
}

/**
 * Automatic event correlation ("Earthquake -> nearby news -> related weather -> grouped
 * event"). Compares every pair of events on distance, country, category, keyword overlap
 * and recency, then attaches the strongest matches as `relatedEvents` (by id).
 *
 * Deliberately non-destructive: events are cross-linked, never merged/collapsed, so no
 * data is lost and existing consumers keep seeing every individual record.
 */
export function attachRelatedEvents(events: GlobalEvent[], options: CorrelationOptions = {}): GlobalEvent[] {
  const opts = { ...DEFAULTS, ...options };
  const pool = events.slice(0, opts.maxEvents);
  const relatedMap = new Map<string, { id: string; score: number }[]>();

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (a.id === b.id) continue;

      const score = correlationScore(a, b, opts);
      if (score < opts.relatedThreshold) continue;

      (relatedMap.get(a.id) ?? relatedMap.set(a.id, []).get(a.id)!).push({ id: b.id, score });
      (relatedMap.get(b.id) ?? relatedMap.set(b.id, []).get(b.id)!).push({ id: a.id, score });
    }
  }

  return events.map((event) => {
    const related = relatedMap.get(event.id);
    if (!related?.length) return event;
    const ids = related
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxRelatedPerEvent)
      .map((r) => r.id);
    return { ...event, relatedEvents: ids };
  });
}

/** Convenience: resolves an event's `relatedEvents` ids back into full GlobalEvent records. */
export function resolveRelatedEvents(events: GlobalEvent[], eventId: string): GlobalEvent[] {
  const byId = new Map(events.map((e) => [e.id, e] as const));
  const target = byId.get(eventId);
  if (!target) return [];
  return target.relatedEvents.map((id) => byId.get(id)).filter((e): e is GlobalEvent => !!e);
}
