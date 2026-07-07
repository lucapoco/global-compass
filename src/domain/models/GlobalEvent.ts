/**
 * GlobalEvent — the single unified domain model for every signal Global Pulse ingests
 * (GNews, USGS, OpenWeather, REST Countries, Supabase saved alerts/intelligence, and
 * future providers). Every external API response is normalized into this shape before
 * it reaches the EventEngine, scoring, filters, search, or the UI.
 *
 * Nothing outside `src/domain` should ever hand raw provider JSON to a component —
 * normalizers (see `services/event-engine/normalizers`) are the only place allowed
 * to read provider-specific field names.
 */

/** Provider that produced the raw data behind this event. */
export type GlobalEventProvider =
  | "gnews"
  | "usgs"
  | "openweather"
  | "rest_countries"
  | "supabase_alerts"
  | "supabase_intelligence"
  | "internal";

/** Broad topical bucket. Superset of every category already used across the app. */
export type GlobalEventCategory =
  | "geopolitics"
  | "military"
  | "economy"
  | "technology"
  | "energy"
  | "climate"
  | "disaster"
  | "cyber"
  | "health"
  | "earthquake"
  | "weather"
  | "country"
  | "general";

/** Deterministic severity bucket. Lowercase to stay compatible with existing UI enums. */
export type GlobalEventSeverity = "low" | "medium" | "high" | "critical";

/** How trustworthy / fresh the underlying data is. Never fabricated — always derived. */
export type GlobalEventStatus = "live" | "cached" | "demo" | "error";

export interface GlobalEventCoordinates {
  lat: number;
  lng: number;
}

/**
 * Reusable, deterministic scoring block. All four numbers are computed by
 * `services/event-engine/scoring` — never invented, never AI-generated.
 */
export interface GlobalEventScore {
  /** 0-100. How confident we are the underlying data is accurate/fresh. */
  confidence: number;
  /** 0-100. How newsworthy/urgent this event is on its own. */
  importance: number;
  /** 0-100. Composite of severity + importance + confidence. Used for sorting/alerts. */
  riskScore: number;
}

export interface GlobalEvent {
  id: string;
  title: string;
  /** One-line human summary (falls back to a trimmed description when the provider has none). */
  summary: string;
  description?: string;
  category: GlobalEventCategory;
  /** Optional finer-grained label within `category` (e.g. "M6+ earthquake", "cyberattack"). */
  subCategory?: string;
  severity: GlobalEventSeverity;
  /** 0-100, see `GlobalEventScore`. Duplicated at the top level for easy sorting. */
  importance: number;
  /** 0-100, see `GlobalEventScore`. */
  confidence: number;
  /** 0-100 composite risk, see `GlobalEventScore`. */
  riskScore: number;
  /** Display name of the origin, e.g. "GNews", "USGS", "Reuters". */
  source: string;
  sourceUrl?: string;
  provider: GlobalEventProvider;
  country?: string;
  countryCode?: string;
  locationName?: string;
  coordinates?: GlobalEventCoordinates;
  /** When the underlying event happened / was published (ISO 8601). */
  timestamp: string;
  /** When this GlobalEvent record was normalized/refreshed (ISO 8601). */
  updatedAt: string;
  image?: string;
  /** Lucide icon name hint for the UI layer; optional, never required. */
  icon?: string;
  tags: string[];
  status: GlobalEventStatus;
  /** True for provider data considered authoritative (USGS, REST Countries, live GNews). */
  verified: boolean;
  /** True when the record reflects a live network fetch (mirrors `status === "live"`). */
  live: boolean;
  /** True for editorially/algorithmically highlighted events (critical+ severity, etc.). */
  featured: boolean;
  /** Provider-specific extra fields (magnitude, depth, humidity, population, ...). */
  metadata: Record<string, unknown>;
  /** Optional AI-generated one-liner. Left undefined until an AI module populates it. */
  aiSummary?: string;
  /** IDs of correlated GlobalEvents, filled in by the correlation engine. */
  relatedEvents: string[];
}

/** Convenience factory so normalizers only need to specify what actually varies. */
export function createGlobalEvent(partial: Omit<GlobalEvent, "importance" | "confidence" | "riskScore" | "relatedEvents" | "tags" | "verified" | "live" | "featured" | "updatedAt" | "metadata" | "summary"> & Partial<Pick<GlobalEvent, "importance" | "confidence" | "riskScore" | "relatedEvents" | "tags" | "verified" | "live" | "featured" | "updatedAt" | "metadata" | "summary">>): GlobalEvent {
  return {
    summary: partial.description ? partial.description.slice(0, 220) : partial.title,
    importance: 0,
    confidence: 0,
    riskScore: 0,
    tags: [],
    verified: false,
    live: partial.status === "live",
    featured: false,
    metadata: {},
    updatedAt: new Date().toISOString(),
    relatedEvents: [],
    ...partial,
  };
}
