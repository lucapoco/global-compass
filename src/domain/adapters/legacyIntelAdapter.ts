/**
 * Bridges the unified domain `GlobalEvent` (Global Pulse Intelligence Engine)
 * to the pre-existing `IntelligenceItem` / `Earthquake` / `CountryRisk` shapes
 * (`@/types`) that dozens of Dashboard/Feed/Analytics panels already render.
 *
 * This is what lets those panels keep their exact prop contracts — and thus
 * their exact visual design — while the DATA now flows from the
 * `IntelligenceStore` (every provider: GNews, USGS, GDACS, ReliefWeb, GDELT,
 * RSS, ACLED, NASA FIRMS, World Bank...) instead of a single GNews-only
 * legacy fetch. No component below this adapter needs to change.
 */
import type { GlobalEvent as DomainEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type {
  IntelligenceItem,
  IntelligenceCategory,
  Earthquake,
  CountryRisk,
  Severity,
} from "@/types";
import type { TopRiskCountry } from "@/domain/decision";
import type { CountryRiskAssessment } from "@/domain/gpie/models/CountryIntelligence";
import { isIntelligenceSignal } from "@/domain/constants/metadataProviders";

/** Domain categories are a strict superset of `IntelligenceCategory` — collapse the extras. */
function toIntelligenceCategory(category: GlobalEventCategory): IntelligenceCategory {
  if (category === "country" || category === "earthquake" || category === "weather") return "general";
  return category;
}

/** Converts one normalized event into the legacy `IntelligenceItem` shape. */
export function toIntelligenceItem(event: DomainEvent): IntelligenceItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? event.summary,
    category: toIntelligenceCategory(event.category),
    severity: event.severity,
    country: event.country,
    source: event.source,
    url: event.sourceUrl,
    imageUrl: event.image,
    publishedAt: event.timestamp,
    latitude: event.coordinates?.lat,
    longitude: event.coordinates?.lng,
    isLive: event.live,
  };
}

/**
 * Converts a mixed `GlobalEvent[]` into `IntelligenceItem[]`, excluding pure
 * earthquake events (which have their own `Earthquake[]` representation via
 * `toEarthquakes`) so the two lists stay non-overlapping — exactly like the
 * old GNews-only `intel` vs USGS-only `quakes` split, just multi-provider now.
 */
export function toIntelligenceItems(events: DomainEvent[]): IntelligenceItem[] {
  return events.filter((e) => e.provider !== "usgs" && isIntelligenceSignal(e)).map(toIntelligenceItem);
}

/** Converts a `usgs`-provider `GlobalEvent` back into the legacy `Earthquake` shape. */
export function toEarthquake(event: DomainEvent): Earthquake {
  const meta = event.metadata as { originalId?: string; magnitude?: number; depthKm?: number };
  return {
    id: String(meta.originalId ?? event.id),
    place: event.locationName ?? event.title,
    magnitude: meta.magnitude ?? 0,
    time: new Date(event.timestamp).getTime(),
    depth: meta.depthKm ?? 0,
    longitude: event.coordinates?.lng ?? 0,
    latitude: event.coordinates?.lat ?? 0,
    url: event.sourceUrl,
  };
}

export function toEarthquakes(events: DomainEvent[]): Earthquake[] {
  return events.filter((e) => e.provider === "usgs").map(toEarthquake);
}

const SEVERITY_LABELS: Record<string, Severity> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Converts a store `TopRiskCountry` into the legacy `CountryRisk` card shape. */
export function toCountryRisk(entry: TopRiskCountry): CountryRisk {
  const factors: string[] = [];
  if (entry.criticalCount > 0) factors.push(`${entry.criticalCount} critical event${entry.criticalCount > 1 ? "s" : ""}`);
  factors.push(`${entry.eventCount} tracked event${entry.eventCount > 1 ? "s" : ""}`);
  factors.push(`Dominant category: ${entry.topCategory}`);

  const score = entry.riskScore;
  const labelKey =
    score >= 65 ? "critical" : score >= 40 ? "high" : score >= 20 ? "medium" : "low";

  return {
    country: entry.country,
    score,
    label: SEVERITY_LABELS[labelKey],
    factors: factors.slice(0, 3),
  };
}

export function toCountryRisks(entries: TopRiskCountry[]): CountryRisk[] {
  return entries.map(toCountryRisk);
}

const TIER_TO_SEVERITY: Record<CountryRiskAssessment["tier"], Severity> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Low",
};

/** Converts `getCountryIntelligence()`'s risk assessment into the legacy `CountryRisk` card shape. */
export function toCountryRiskFromAssessment(countryName: string, risk: CountryRiskAssessment): CountryRisk {
  return {
    country: countryName,
    score: risk.score,
    label: TIER_TO_SEVERITY[risk.tier],
    factors: risk.drivers,
  };
}
