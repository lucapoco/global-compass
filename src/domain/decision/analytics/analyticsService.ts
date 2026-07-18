/**
 * Analytics Service
 *
 * Computes the analytics dashboard metrics that power the platform's
 * reporting and situational awareness features.
 *
 * All functions are pure and synchronous — they operate on a
 * GlobalEvent[] already fetched by the EventEngine. No network calls.
 *
 * Metrics provided:
 *   • Top 10 highest-risk countries
 *   • Category breakdown (events per category)
 *   • Provider distribution
 *   • Daily activity timeline
 *   • Full AnalyticsSummary bundle
 */
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import { filterIntelligenceSignals } from "@/domain/constants/metadataProviders";
import type {
  AnalyticsSummary,
  TopRiskCountry,
  ProviderDistributionEntry,
} from "../models/ReportModel";

// ─── Category labels ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Partial<Record<GlobalEventCategory, string>> = {
  geopolitics:  "Geopolitics",
  military:     "Military / Conflict",
  economy:      "Economy",
  technology:   "Technology",
  energy:       "Energy",
  climate:      "Climate",
  disaster:     "Natural Disasters",
  cyber:        "Cyber",
  health:       "Health",
  earthquake:   "Earthquakes",
  weather:      "Weather",
  country:      "Country",
  general:      "General",
};

const PROVIDER_LABELS: Record<string, string> = {
  gnews:                  "GNews",
  usgs:                   "USGS Earthquakes",
  openweather:            "OpenWeather",
  rest_countries:         "REST Countries",
  supabase_alerts:        "Saved Alerts",
  supabase_intelligence:  "Saved Intelligence",
  nasa_eonet:             "NASA EONET",
  acled:                  "ACLED",
  world_bank:             "World Bank",
  internal:               "Internal",
};

// ─── Top risk countries ────────────────────────────────────────────────────────

export function computeTopRiskCountries(events: GlobalEvent[], topN = 10): TopRiskCountry[] {
  const byCountry = new Map<string, GlobalEvent[]>();
  for (const e of filterIntelligenceSignals(events)) {
    if (!e.country) continue;
    const arr = byCountry.get(e.country) ?? [];
    arr.push(e);
    byCountry.set(e.country, arr);
  }

  const entries = [...byCountry.entries()].map(([country, countryEvents]) => {
    const riskScore = Math.round(
      countryEvents.reduce((s, e) => s + e.riskScore, 0) / countryEvents.length,
    );
    const criticalCount = countryEvents.filter((e) => e.severity === "critical").length;

    // Dominant category
    const catCounts = new Map<GlobalEventCategory, number>();
    for (const e of countryEvents) catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
    const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";

    return {
      rank: 0,
      country,
      riskScore,
      eventCount: countryEvents.length,
      criticalCount,
      trend: "stable" as const,
      topCategory,
    };
  });

  return entries
    .sort((a, b) => b.riskScore - a.riskScore || b.criticalCount - a.criticalCount)
    .slice(0, topN)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ─── Category breakdown ───────────────────────────────────────────────────────

export function computeCategoryBreakdown(events: GlobalEvent[]) {
  const catMap = new Map<GlobalEventCategory, GlobalEvent[]>();
  for (const e of events) {
    const arr = catMap.get(e.category) ?? [];
    arr.push(e);
    catMap.set(e.category, arr);
  }

  return [...catMap.entries()]
    .map(([category, catEvents]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      count: catEvents.length,
      share: catEvents.length / Math.max(1, events.length),
      avgRisk: Math.round(catEvents.reduce((s, e) => s + e.riskScore, 0) / catEvents.length),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Provider distribution ────────────────────────────────────────────────────

export function computeProviderDistribution(events: GlobalEvent[]): ProviderDistributionEntry[] {
  const providerMap = new Map<string, GlobalEvent[]>();
  for (const e of events) {
    const arr = providerMap.get(e.provider) ?? [];
    arr.push(e);
    providerMap.set(e.provider, arr);
  }

  return [...providerMap.entries()]
    .map(([provider, provEvents]) => ({
      provider,
      label: PROVIDER_LABELS[provider] ?? provider,
      eventCount: provEvents.length,
      share: provEvents.length / Math.max(1, events.length),
      avgConfidence: Math.round(provEvents.reduce((s, e) => s + e.confidence, 0) / provEvents.length),
      avgRiskScore: Math.round(provEvents.reduce((s, e) => s + e.riskScore, 0) / provEvents.length),
      liveCount: provEvents.filter((e) => e.live).length,
    }))
    .sort((a, b) => b.eventCount - a.eventCount);
}

// ─── Daily activity ───────────────────────────────────────────────────────────

export function computeDailyActivity(events: GlobalEvent[], days = 7) {
  const DAY = 86_400_000;
  const now = Date.now();
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = now - (i + 1) * DAY;
    const dayEnd = now - i * DAY;

    const dayEvents = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && t >= dayStart && t < dayEnd;
    });

    const date = new Date(dayStart);
    const dateLabel =
      i === 0 ? "Today" :
      i === 1 ? "Yesterday" :
      date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    result.push({
      dateLabel,
      dateMs: dayStart,
      eventCount: dayEvents.length,
      criticalCount: dayEvents.filter((e) => e.severity === "critical").length,
      avgRisk: dayEvents.length > 0
        ? Math.round(dayEvents.reduce((s, e) => s + e.riskScore, 0) / dayEvents.length)
        : 0,
    });
  }

  return result;
}

// ─── Full analytics bundle ────────────────────────────────────────────────────

export function buildAnalyticsSummary(events: GlobalEvent[]): AnalyticsSummary {
  const signals = filterIntelligenceSignals(events);
  return {
    topRiskCountries: computeTopRiskCountries(signals),
    categoryBreakdown: computeCategoryBreakdown(signals),
    providerDistribution: computeProviderDistribution(signals),
    dailyActivity: computeDailyActivity(signals),
    totalEvents: signals.length,
    criticalEvents: signals.filter((e) => e.severity === "critical").length,
    liveEvents: signals.filter((e) => e.live).length,
    avgGlobalRisk: signals.length > 0
      ? Math.round(signals.reduce((s, e) => s + e.riskScore, 0) / signals.length)
      : 0,
    calculatedAt: new Date().toISOString(),
  };
}
