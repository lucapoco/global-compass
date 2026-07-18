/**
 * Risk Evolution Analytics
 *
 * Computes how the global risk score and per-country risk have changed
 * over time, enabling the UI to display trends, escalations, and de-escalations.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OUTPUTS
 * ─────────────────────────────────────────────────────────────────────────
 *   GlobalRiskTimeSeries   — hourly/daily risk score samples
 *   CountryRiskProfile     — per-country risk with trend direction
 *   EscalationSignal       — detected rapid risk increases
 *   RiskEvolutionReport    — full analytics bundle
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Bucket events into time slots (1h for <2d window, 6h for <7d, 1d for 30d).
 * 2. For each bucket: sum(severity_weight) / event_count → risk sample.
 * 3. Smooth with a simple 3-point moving average to reduce noise.
 * 4. Detect escalation: bucket where risk increased >20 points vs prior bucket.
 * 5. Per-country: apply same bucketing, then compute trend direction.
 */
import type { GlobalEvent, GlobalEventSeverity } from "@/domain/models/GlobalEvent";

// ─── Severity weights ─────────────────────────────────────────────────────────

const SEV_WEIGHT: Record<GlobalEventSeverity, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 15,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskSample {
  periodMs: number;
  periodLabel: string;
  riskScore: number;
  eventCount: number;
  criticalCount: number;
}

export interface CountryRiskProfile {
  country: string;
  currentRisk: number;
  trend: "escalating" | "stable" | "declining";
  trendDelta: number;  // current - previous period risk
  samples: RiskSample[];
  topCategories: string[];
}

export interface EscalationSignal {
  periodMs: number;
  periodLabel: string;
  riskBefore: number;
  riskAfter: number;
  delta: number;
  affectedCountries: string[];
  triggerEvents: string[];  // event IDs driving the spike
}

export interface RiskEvolutionReport {
  globalSamples: RiskSample[];
  /** Smoothed version of globalSamples (3-point moving average). */
  smoothedSamples: RiskSample[];
  countryProfiles: CountryRiskProfile[];
  escalationSignals: EscalationSignal[];
  /** Current global risk score (latest sample). */
  currentGlobalRisk: number;
  /** 0–1 trend: >0.05 = escalating, <−0.05 = declining, else stable. */
  globalTrend: "escalating" | "stable" | "declining";
  generatedAt: string;
}

// ─── Bucket helpers ───────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const DAY = 86_400_000;

function bucketSizeMs(windowMs: number): number {
  if (windowMs <= 2 * DAY) return HOUR;
  if (windowMs <= 7 * DAY) return 6 * HOUR;
  return DAY;
}

function bucketKey(ms: number, bucketMs: number): number {
  return Math.floor(ms / bucketMs) * bucketMs;
}

function bucketLabel(ms: number, bucketMs: number): string {
  const d = new Date(ms);
  if (bucketMs <= HOUR) {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (bucketMs <= 6 * HOUR) {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit" }) + ":00";
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Risk computation ─────────────────────────────────────────────────────────

function riskFromEvents(events: GlobalEvent[]): number {
  if (!events.length) return 0;
  const total = events.reduce((s, e) => s + SEV_WEIGHT[e.severity], 0);
  return Math.min(100, Math.round(total / events.length));
}

function bucketEvents(
  events: GlobalEvent[],
  bucketMs: number,
): Map<number, GlobalEvent[]> {
  const buckets = new Map<number, GlobalEvent[]>();
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (isNaN(t)) continue;
    const key = bucketKey(t, bucketMs);
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }
  return buckets;
}

function toSamples(
  buckets: Map<number, GlobalEvent[]>,
  bucketMs: number,
): RiskSample[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, events]) => ({
      periodMs: ms,
      periodLabel: bucketLabel(ms, bucketMs),
      riskScore: riskFromEvents(events),
      eventCount: events.length,
      criticalCount: events.filter((e) => e.severity === "critical").length,
    }));
}

function smooth(samples: RiskSample[]): RiskSample[] {
  return samples.map((s, i) => {
    if (i === 0 || i === samples.length - 1) return s;
    const avg = Math.round(
      (samples[i - 1].riskScore + s.riskScore + samples[i + 1].riskScore) / 3,
    );
    return { ...s, riskScore: avg };
  });
}

function detectEscalations(
  samples: RiskSample[],
  buckets: Map<number, GlobalEvent[]>,
  threshold = 20,
): EscalationSignal[] {
  const signals: EscalationSignal[] = [];
  for (let i = 1; i < samples.length; i++) {
    const delta = samples[i].riskScore - samples[i - 1].riskScore;
    if (delta < threshold) continue;

    const events = buckets.get(samples[i].periodMs) ?? [];
    const countries = [...new Set(events.map((e) => e.country).filter(Boolean) as string[])];
    const triggerEvents = events
      .filter((e) => e.severity === "critical" || e.severity === "high")
      .slice(0, 5)
      .map((e) => e.id);

    signals.push({
      periodMs: samples[i].periodMs,
      periodLabel: samples[i].periodLabel,
      riskBefore: samples[i - 1].riskScore,
      riskAfter: samples[i].riskScore,
      delta,
      affectedCountries: countries,
      triggerEvents,
    });
  }
  return signals;
}

function trendFrom(samples: RiskSample[]): "escalating" | "stable" | "declining" {
  if (samples.length < 2) return "stable";
  const first = samples.slice(0, Math.floor(samples.length / 2));
  const last = samples.slice(Math.floor(samples.length / 2));
  const firstAvg = first.reduce((s, r) => s + r.riskScore, 0) / first.length;
  const lastAvg = last.reduce((s, r) => s + r.riskScore, 0) / last.length;
  const ratio = (lastAvg - firstAvg) / Math.max(1, firstAvg);
  if (ratio > 0.05) return "escalating";
  if (ratio < -0.05) return "declining";
  return "stable";
}

// ─── Per-country analytics ────────────────────────────────────────────────────

function buildCountryProfile(
  country: string,
  events: GlobalEvent[],
  bucketMs: number,
): CountryRiskProfile {
  const buckets = bucketEvents(events, bucketMs);
  const samples = toSamples(buckets, bucketMs);
  const trend = trendFrom(samples);

  const trendDelta =
    samples.length >= 2
      ? (samples[samples.length - 1].riskScore - samples[samples.length - 2].riskScore)
      : 0;

  const catCounts = new Map<string, number>();
  for (const e of events) {
    catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
  }
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  return {
    country,
    currentRisk: samples[samples.length - 1]?.riskScore ?? 0,
    trend,
    trendDelta,
    samples,
    topCategories,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a complete risk evolution report from a set of GlobalEvents.
 *
 * @param events    Events to analyze (from EventEngine.loadAll())
 * @param windowMs  Analysis window in ms (default 7 days)
 */
export function buildRiskEvolutionReport(
  events: GlobalEvent[],
  windowMs = 7 * DAY,
): RiskEvolutionReport {
  const now = Date.now();
  const inWindow = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t >= now - windowMs && t <= now;
  });

  const bucketMs = bucketSizeMs(windowMs);
  const globalBuckets = bucketEvents(inWindow, bucketMs);
  const globalSamples = toSamples(globalBuckets, bucketMs);
  const smoothedSamples = smooth(globalSamples);

  const escalationSignals = detectEscalations(globalSamples, globalBuckets);

  // Per-country profiles (top 10 countries by event count)
  const byCountry = new Map<string, GlobalEvent[]>();
  for (const e of inWindow) {
    if (!e.country) continue;
    const arr = byCountry.get(e.country) ?? [];
    arr.push(e);
    byCountry.set(e.country, arr);
  }

  const countryProfiles = [...byCountry.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([country, ev]) => buildCountryProfile(country, ev, bucketMs));

  const currentGlobalRisk =
    globalSamples[globalSamples.length - 1]?.riskScore ?? 0;
  const globalTrend = trendFrom(globalSamples);

  return {
    globalSamples,
    smoothedSamples,
    countryProfiles,
    escalationSignals,
    currentGlobalRisk,
    globalTrend,
    generatedAt: new Date().toISOString(),
  };
}
