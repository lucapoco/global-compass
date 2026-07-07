import type { GlobalEvent, GlobalEventCategory, GlobalEventProvider, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { ageMs } from "@/domain/utils/time";

/**
 * Every page shares this single filter shape (category, country, severity, provider,
 * time window, risk, verified, featured, live) so filtering logic is never duplicated.
 */
export interface EventFilterOptions {
  categories?: GlobalEventCategory[];
  countries?: string[];
  severities?: GlobalEventSeverity[];
  providers?: GlobalEventProvider[];
  /** Only events newer than `now - sinceMs`. */
  sinceMs?: number;
  minRiskScore?: number;
  minConfidence?: number;
  verifiedOnly?: boolean;
  featuredOnly?: boolean;
  liveOnly?: boolean;
}

function matchesSet<T extends string>(value: T | undefined, set: T[] | undefined): boolean {
  if (!set?.length) return true;
  if (!value) return false;
  return set.includes(value);
}

export function filterEvents(events: GlobalEvent[], opts: EventFilterOptions = {}): GlobalEvent[] {
  const countries = opts.countries?.map((c) => c.toLowerCase());

  return events.filter((event) => {
    if (!matchesSet(event.category, opts.categories)) return false;
    if (!matchesSet(event.severity, opts.severities)) return false;
    if (!matchesSet(event.provider, opts.providers)) return false;
    if (countries?.length && !countries.includes((event.country ?? "").toLowerCase())) return false;
    if (opts.sinceMs !== undefined && ageMs(event.timestamp) > opts.sinceMs) return false;
    if (opts.minRiskScore !== undefined && event.riskScore < opts.minRiskScore) return false;
    if (opts.minConfidence !== undefined && event.confidence < opts.minConfidence) return false;
    if (opts.verifiedOnly && !event.verified) return false;
    if (opts.featuredOnly && !event.featured) return false;
    if (opts.liveOnly && !event.live) return false;
    return true;
  });
}

export const EMPTY_EVENT_FILTERS: EventFilterOptions = {};
