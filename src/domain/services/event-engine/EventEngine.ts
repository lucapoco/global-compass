import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import { scoreEvent } from "./scoring";
import { dedupeEvents } from "./timeline/dedupeEvents";
import { attachRelatedEvents, resolveRelatedEvents, type CorrelationOptions } from "./timeline/correlateEvents";
import { filterEvents, type EventFilterOptions } from "./filters/eventFilters";
import { searchEvents } from "./search/searchEvents";
import { defaultEventProviders, type EventProvider, type ProviderStatusSnapshot } from "./providers";
import { detectPrimaryCountry } from "@/services/intelligence/nlp/entityExtractor";

export interface LoadAllOptions {
  /** Restrict to a subset of providers (defaults to every registered bulk provider). */
  providerIds?: GlobalEventProvider[];
  /** Bypass every provider's own cache and force a fresh network fetch. */
  force?: boolean;
  /** Run correlation after loading (default true — disable for very large ad-hoc loads). */
  correlate?: boolean;
  correlationOptions?: CorrelationOptions;
}

function sortByRecency(events: GlobalEvent[]): GlobalEvent[] {
  return [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Fill missing `country` from title/description/location so risk rankings are not empty. */
function enrichCountry(event: GlobalEvent): GlobalEvent {
  if (event.country?.trim()) return event;
  const blob = [event.title, event.description, event.summary, event.locationName]
    .filter(Boolean)
    .join(" ");
  const country = detectPrimaryCountry(blob);
  return country ? { ...event, country, locationName: event.locationName ?? country } : event;
}

/**
 * EventEngine — the single entry point every page should use instead of calling
 * individual API services directly. Responsible for:
 *   1. loading providers (in parallel, each with its own cache/TTL)
 *   2. normalizing raw provider data into GlobalEvent (done inside providers)
 *   3. deduplicating
 *   4. scoring (severity/importance/confidence/riskScore)
 *   5. correlating ("merging" related events via `relatedEvents`)
 *   6. sorting
 *   7. exposing filter/search helpers that operate on the unified output
 */
export class EventEngine {
  private lastLoad: GlobalEvent[] = [];

  constructor(private readonly providers: EventProvider[] = defaultEventProviders) {}

  /** Loads + normalizes + dedupes + scores + correlates every registered provider. */
  async loadAll(options: LoadAllOptions = {}): Promise<GlobalEvent[]> {
    const active = options.providerIds
      ? this.providers.filter((p) => options.providerIds!.includes(p.id))
      : this.providers;

    const results = await Promise.all(
      active.map((provider) =>
        provider.load({ force: options.force }).catch((e) => {
          console.warn(`[EventEngine] provider "${provider.id}" failed`, e);
          return [] as GlobalEvent[];
        }),
      ),
    );

    let events = dedupeEvents(results.flat());
    events = events.map((e) => scoreEvent(enrichCountry(e)));

    if (options.correlate ?? true) {
      events = attachRelatedEvents(events, options.correlationOptions);
    }

    events = sortByRecency(events);
    this.lastLoad = events;
    return events;
  }

  /** Filters the most recently loaded (or a supplied) event set using the shared filter contract. */
  filter(events: GlobalEvent[] | null, opts: EventFilterOptions): GlobalEvent[] {
    return filterEvents(events ?? this.lastLoad, opts);
  }

  /** Unified search over country / city / title / tags / provider / category. */
  search(events: GlobalEvent[] | null, query: string): GlobalEvent[] {
    return searchEvents(events ?? this.lastLoad, query);
  }

  /** Resolves an event's `relatedEvents` ids back into full records. */
  getRelated(events: GlobalEvent[] | null, eventId: string): GlobalEvent[] {
    return resolveRelatedEvents(events ?? this.lastLoad, eventId);
  }

  /** Cache/freshness snapshot for every registered provider (for status badges/debug panels). */
  getProviderStatus(): ProviderStatusSnapshot[] {
    return this.providers.map((p) => p.getStatus());
  }

  /** The events produced by the most recent `loadAll()` call, without re-fetching. */
  getLastLoaded(): GlobalEvent[] {
    return this.lastLoad;
  }
}

/** Shared singleton — import this from pages/hooks instead of constructing a new engine. */
export const eventEngine = new EventEngine();
