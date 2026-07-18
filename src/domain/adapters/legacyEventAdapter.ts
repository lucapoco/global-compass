/**
 * Bridges the new domain `GlobalEvent` (src/domain/models/GlobalEvent.ts) to the
 * pre-existing, map-oriented `GlobalEvent` shape in `@/types` that the Live World Map,
 * side panel and filter utilities already render.
 *
 * This is what lets `mapDataService` move onto the EventEngine internally while every
 * consuming component (`ProfessionalWorldMap`, `MapSidePanel`, `src/utils/filterEvents.ts`,
 * `src/routes/map.tsx`) keeps working without a single line changed.
 */
import type { GlobalEvent as DomainEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import type { GlobalEvent as LegacyMapEvent, EventCategory as LegacyCategory, EventLayer } from "@/types";

const PROVIDER_TO_LAYER: Record<GlobalEventProvider, EventLayer> = {
  gnews: "intelligence",
  usgs: "earthquakes",
  rest_countries: "capitals",
  supabase_alerts: "saved_alerts",
  supabase_intelligence: "intelligence",
  openweather: "weather",
  nasa_eonet: "disasters",
  acled: "intelligence",
  world_bank: "intelligence",
  gdacs: "disasters",
  nasa_firms: "disasters",
  reliefweb: "humanitarian",
  gdelt: "intelligence",
  rss: "intelligence",
  internal: "intelligence",
};

/** Domain categories are a strict superset of the legacy ones — only "country" needs remapping. */
function toLegacyCategory(category: DomainEvent["category"]): LegacyCategory {
  if (category === "country") return "general";
  return category;
}

export function toLegacyMapEvent(event: DomainEvent): LegacyMapEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? event.summary,
    category: toLegacyCategory(event.category),
    severity: event.severity,
    layer: PROVIDER_TO_LAYER[event.provider],
    source: event.source,
    url: event.sourceUrl,
    country: event.country,
    location: event.locationName,
    latitude: event.coordinates?.lat,
    longitude: event.coordinates?.lng,
    publishedAt: event.timestamp,
    isLive: event.live,
    isDemo: event.status === "demo",
    isSaved: event.provider === "supabase_alerts" || event.provider === "supabase_intelligence",
  };
}

export function toLegacyMapEvents(events: DomainEvent[]): LegacyMapEvent[] {
  return events.map(toLegacyMapEvent);
}
