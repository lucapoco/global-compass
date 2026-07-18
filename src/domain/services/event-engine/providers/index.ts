import { gnewsProvider } from "./gnewsProvider";
import { earthquakeProvider } from "./earthquakeProvider";
import { countryProvider } from "./countryProvider";
import { savedAlertsProvider } from "./savedAlertsProvider";
import { savedIntelligenceProvider } from "./savedIntelligenceProvider";
import { nasaEonetProvider } from "./nasaEonetProvider";
import { acledProvider } from "./acledProvider"; // server-proxy backed
import { gdacsProvider } from "@/domain/gpie/providers/gdacs/provider";
import { reliefwebProvider } from "@/domain/gpie/providers/reliefweb/provider";
import { gdeltProvider } from "@/domain/gpie/providers/gdelt/provider";
import { rssProvider } from "@/domain/gpie/providers/rss/provider";
import { firmsProvider } from "@/domain/gpie/providers/firms/provider";
import { worldBankMapProvider } from "@/domain/gpie/providers/worldbank-map/provider";
import type { EventProvider } from "./types";

export { gnewsProvider } from "./gnewsProvider";
export { earthquakeProvider } from "./earthquakeProvider";
export { countryProvider } from "./countryProvider";
export { savedAlertsProvider } from "./savedAlertsProvider";
export { savedIntelligenceProvider } from "./savedIntelligenceProvider";
export { weatherProvider } from "./weatherProvider";
export { nasaEonetProvider } from "./nasaEonetProvider";
export { acledProvider } from "./acledProvider";
export { gdacsProvider } from "@/domain/gpie/providers/gdacs/provider";
export { reliefwebProvider } from "@/domain/gpie/providers/reliefweb/provider";
export { gdeltProvider } from "@/domain/gpie/providers/gdelt/provider";
export { rssProvider } from "@/domain/gpie/providers/rss/provider";
export { firmsProvider } from "@/domain/gpie/providers/firms/provider";
export { worldBankMapProvider } from "@/domain/gpie/providers/worldbank-map/provider";
export type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";

/**
 * Bulk-feed providers pulled by `EventEngine.loadAll()` by default.
 *
 * Provider order matters: high-confidence authoritative feeds (USGS, GDACS,
 * EONET, FIRMS) are listed before text-derived feeds (GNews, GDELT, RSS) so
 * deduplication and scoring favour the more reliable source when the same
 * event appears in multiple feeds.
 *
 * Notes:
 *  - weatherProvider is on-demand only (called per-city, not globally).
 *  - acledProvider self-disables when server-side ACLED credentials are absent.
 *  - firmsProvider self-disables when FIRMS_MAP_KEY is absent.
 *  - gdacsProvider, reliefwebProvider, gdeltProvider, rssProvider work with no key.
 */
export const defaultEventProviders: EventProvider[] = [
  earthquakeProvider,      // USGS — authoritative seismic, no rate limit
  gdacsProvider,           // GDACS — UN/EC multi-hazard disaster alerts, no key
  nasaEonetProvider,       // NASA EONET — natural events, open CORS
  firmsProvider,           // NASA FIRMS — active fire detection (disabled if no key)
  acledProvider,           // ACLED — armed conflict (disabled if no key)
  reliefwebProvider,       // ReliefWeb — UN OCHA humanitarian crises, no key
  gnewsProvider,           // GNews — news intelligence feed
  gdeltProvider,           // GDELT — global news index, no key
  rssProvider,             // Trusted broadcaster RSS aggregator, no key
  // rest_countries + world_bank are map-layer metadata only — fetched on demand
  // via providerIds when Economic/Population/Energy/Capitals layers are enabled.
  savedAlertsProvider,     // Supabase — user-saved alerts
  savedIntelligenceProvider, // Supabase — user-bookmarked intelligence
];
