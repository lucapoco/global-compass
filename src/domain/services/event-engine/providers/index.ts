import { gnewsProvider } from "./gnewsProvider";
import { earthquakeProvider } from "./earthquakeProvider";
import { countryProvider } from "./countryProvider";
import { savedAlertsProvider } from "./savedAlertsProvider";
import { savedIntelligenceProvider } from "./savedIntelligenceProvider";
import type { EventProvider } from "./types";

export { gnewsProvider } from "./gnewsProvider";
export { earthquakeProvider } from "./earthquakeProvider";
export { countryProvider } from "./countryProvider";
export { savedAlertsProvider } from "./savedAlertsProvider";
export { savedIntelligenceProvider } from "./savedIntelligenceProvider";
export { weatherProvider } from "./weatherProvider";
export type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";

/** Bulk-feed providers pulled by `EventEngine.loadAll()` by default (weather is on-demand, see weatherProvider). */
export const defaultEventProviders: EventProvider[] = [
  gnewsProvider,
  earthquakeProvider,
  countryProvider,
  savedAlertsProvider,
  savedIntelligenceProvider,
];
