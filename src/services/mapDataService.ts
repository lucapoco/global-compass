import { eventEngine } from "@/domain/services/event-engine";
import { createGlobalEvent, type GlobalEvent, type GlobalEventProvider } from "@/domain/models/GlobalEvent";

/**
 * Live World Map data source — now a thin wrapper around the shared `EventEngine`.
 *
 * GNews, USGS, REST Countries, and Supabase saved alerts/intelligence are all
 * normalized into `GlobalEvent` (see `src/domain`), deduped, scored and correlated
 * inside the engine. The map module (`useMapEngine`, `ProfessionalWorldMap`,
 * `MapSidePanel`, etc.) consumes the rich domain model directly — no more per-page
 * adapters, no raw provider responses reaching the UI.
 */
const DEMO_WEATHER_EVENTS: GlobalEvent[] = [
  createGlobalEvent({
    id: "wx-demo-natl",
    title: "Demo: North Atlantic pressure pattern",
    description: "Illustrative weather layer point (no live per-city feed wired into the map).",
    category: "weather",
    severity: "low",
    importance: 10,
    confidence: 20,
    riskScore: 10,
    source: "Demo",
    provider: "openweather",
    coordinates: { lat: 50, lng: -40 },
    timestamp: new Date().toISOString(),
    status: "demo",
    tags: ["weather", "demo"],
  }),
  createGlobalEvent({
    id: "wx-demo-pac",
    title: "Demo: Pacific trade-wind belt",
    category: "weather",
    severity: "medium",
    importance: 20,
    confidence: 20,
    riskScore: 20,
    source: "Demo",
    provider: "openweather",
    coordinates: { lat: 5, lng: -150 },
    timestamp: new Date().toISOString(),
    status: "demo",
    tags: ["weather", "demo"],
  }),
];

/**
 * Loads and normalizes every map source into unified `GlobalEvent[]` via the EventEngine.
 *
 * `providerIds` scopes the fetch to only the providers required by the map's
 * currently-enabled intelligence layers (see `src/utils/filterEvents.ts`) —
 * layers left off never trigger a network request until the user turns them
 * on. Pass `undefined` to load every registered provider (all layers on).
 */
export async function collectGlobalMapEvents(force = false, providerIds?: GlobalEventProvider[]): Promise<GlobalEvent[]> {
  const events = await eventEngine.loadAll({ providerIds, force });
  return [...events, ...DEMO_WEATHER_EVENTS];
}
