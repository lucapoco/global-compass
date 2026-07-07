import type { GlobalEventProvider, GlobalEventStatus } from "@/domain/models/GlobalEvent";

export interface ConfidenceInput {
  provider: GlobalEventProvider;
  status: GlobalEventStatus;
  verified?: boolean;
}

/** Baseline trust per provider when data is live. Authoritative feeds (USGS, REST Countries) score highest. */
const PROVIDER_BASE_CONFIDENCE: Record<GlobalEventProvider, number> = {
  usgs: 95,
  rest_countries: 95,
  gnews: 78,
  openweather: 82,
  supabase_alerts: 60,
  supabase_intelligence: 60,
  internal: 70,
};

const STATUS_MULTIPLIER: Record<GlobalEventStatus, number> = {
  live: 1,
  cached: 0.75,
  demo: 0.25,
  error: 0.15,
};

/**
 * Deterministic confidence score (0-100): how much a consumer should trust this
 * record's freshness/accuracy. Cached/demo data is never presented as equal to live data.
 */
export function computeConfidence(input: ConfidenceInput): number {
  const base = PROVIDER_BASE_CONFIDENCE[input.provider] ?? 50;
  const multiplied = base * STATUS_MULTIPLIER[input.status];
  const verifiedBonus = input.verified ? 8 : 0;
  return Math.round(Math.min(100, Math.max(0, multiplied + verifiedBonus)));
}
