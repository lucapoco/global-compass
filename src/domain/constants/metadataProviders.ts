/**
 * Metadata vs intelligence signal classification.
 *
 * REST Countries and World Bank supply reference data (flags, population,
 * GDP, capitals) — they must never appear as news/intelligence feed items.
 */
import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";

/** Providers that supply reference metadata only — never feed items. */
export const METADATA_PROVIDERS: readonly GlobalEventProvider[] = [
  "rest_countries",
  "world_bank",
] as const;

/** On-demand providers (per-city weather) — not global intelligence signals. */
export const ON_DEMAND_PROVIDERS: readonly GlobalEventProvider[] = ["openweather"] as const;

export function isMetadataProvider(provider: GlobalEventProvider): boolean {
  return (METADATA_PROVIDERS as readonly string[]).includes(provider);
}

export function isIntelligenceSignal(event: GlobalEvent): boolean {
  if (isMetadataProvider(event.provider)) return false;
  if ((ON_DEMAND_PROVIDERS as readonly string[]).includes(event.provider)) return false;
  if (event.category === "country") return false;
  return true;
}

export function filterIntelligenceSignals(events: GlobalEvent[]): GlobalEvent[] {
  return events.filter(isIntelligenceSignal);
}
