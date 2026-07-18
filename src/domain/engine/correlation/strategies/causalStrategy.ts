/**
 * Causal Pattern Strategy
 *
 * Detects known cause → effect patterns between events using a configurable
 * rule library. This is the strategy most likely to produce "escalation" and
 * "cause_effect" relationship types.
 *
 * Each rule specifies:
 *   cause    — category (and optional keywords) of the triggering event
 *   effect   — category (and optional keywords) of the resulting event
 *   maxHours — max time gap between cause and effect (effect always after cause)
 *   confidence — base confidence when the pattern fires
 *   name / explanation — for the explainability layer
 *
 * The strategy fires when:
 *   1. Event A matches the cause pattern
 *   2. Event B matches the effect pattern (or vice versa)
 *   3. The time gap is within `maxHours`
 *   4. Both events share the same country (strongly preferred)
 *      OR lack country information (global events)
 *
 * Pattern library covers the most common intelligence-relevant causal chains.
 * Adding a new pattern requires only appending to CAUSAL_RULES — no code changes.
 */
import { hoursBetween } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type { CorrelationStrategy, CorrelationEngineConfig, StrategyResult } from "../types";

// ─── Pattern definition ────────────────────────────────────────────────────────

interface CausalPattern {
  name: string;
  cause: { category: GlobalEventCategory; keywords?: string[] };
  effect: { category: GlobalEventCategory; keywords?: string[] };
  /** Max time between cause and effect in hours (effect must occur AFTER cause). */
  maxHours: number;
  /** 0–100 base confidence when this pattern fires. */
  confidence: number;
  /** Boost when both events are in the same country. */
  sameCountryBoost: number;
  explanation: string;
}

// ─── Rule library ──────────────────────────────────────────────────────────────

const CAUSAL_RULES: CausalPattern[] = [
  // Seismic cascades
  {
    name: "earthquake_disaster",
    cause: { category: "earthquake" },
    effect: { category: "disaster" },
    maxHours: 24,
    confidence: 80,
    sameCountryBoost: 10,
    explanation: "Earthquakes frequently trigger secondary disasters (landslides, fires, infrastructure collapse)",
  },
  {
    name: "earthquake_tsunami",
    cause: { category: "earthquake" },
    effect: { category: "weather", keywords: ["tsunami", "wave", "surge", "flood"] },
    maxHours: 6,
    confidence: 85,
    sameCountryBoost: 5,
    explanation: "Undersea earthquakes are the primary cause of tsunamis",
  },
  {
    name: "earthquake_economy",
    cause: { category: "earthquake" },
    effect: { category: "economy" },
    maxHours: 72,
    confidence: 60,
    sameCountryBoost: 15,
    explanation: "Major earthquakes disrupt supply chains and economic activity",
  },

  // Conflict cascades
  {
    name: "military_economy",
    cause: { category: "military" },
    effect: { category: "economy" },
    maxHours: 96,
    confidence: 65,
    sameCountryBoost: 15,
    explanation: "Armed conflict disrupts trade, investment, and economic stability",
  },
  {
    name: "military_humanitarian",
    cause: { category: "military" },
    effect: { category: "health" },
    maxHours: 168,
    confidence: 60,
    sameCountryBoost: 15,
    explanation: "Conflict causes displacement, healthcare disruption, and humanitarian crises",
  },
  {
    name: "military_geopolitics",
    cause: { category: "military" },
    effect: { category: "geopolitics" },
    maxHours: 72,
    confidence: 70,
    sameCountryBoost: 10,
    explanation: "Military operations trigger diplomatic responses and geopolitical shifts",
  },

  // Climate cascades
  {
    name: "climate_disaster",
    cause: { category: "climate" },
    effect: { category: "disaster" },
    maxHours: 48,
    confidence: 70,
    sameCountryBoost: 15,
    explanation: "Extreme climate conditions amplify natural disasters",
  },
  {
    name: "climate_economy",
    cause: { category: "climate" },
    effect: { category: "economy" },
    maxHours: 120,
    confidence: 55,
    sameCountryBoost: 10,
    explanation: "Droughts, floods, and heat waves damage agricultural and industrial output",
  },

  // Disaster cascades
  {
    name: "disaster_geopolitics",
    cause: { category: "disaster" },
    effect: { category: "geopolitics" },
    maxHours: 168,
    confidence: 55,
    sameCountryBoost: 15,
    explanation: "Large disasters trigger political responses, aid requests, and governance crises",
  },
  {
    name: "disaster_economy",
    cause: { category: "disaster" },
    effect: { category: "economy" },
    maxHours: 120,
    confidence: 60,
    sameCountryBoost: 15,
    explanation: "Natural disasters destroy infrastructure and disrupt economic activity",
  },

  // Cyber cascades
  {
    name: "cyber_economy",
    cause: { category: "cyber" },
    effect: { category: "economy" },
    maxHours: 48,
    confidence: 65,
    sameCountryBoost: 10,
    explanation: "Cyberattacks on financial or critical infrastructure cause economic disruption",
  },
  {
    name: "cyber_geopolitics",
    cause: { category: "cyber" },
    effect: { category: "geopolitics" },
    maxHours: 72,
    confidence: 65,
    sameCountryBoost: 5,
    explanation: "State-attributed cyberattacks escalate into diplomatic incidents",
  },

  // Energy cascades
  {
    name: "energy_economy",
    cause: { category: "energy" },
    effect: { category: "economy" },
    maxHours: 96,
    confidence: 68,
    sameCountryBoost: 10,
    explanation: "Energy supply disruptions directly impact manufacturing, transport, and GDP",
  },
  {
    name: "energy_geopolitics",
    cause: { category: "energy" },
    effect: { category: "geopolitics" },
    maxHours: 168,
    confidence: 62,
    sameCountryBoost: 5,
    explanation: "Energy supply changes drive geopolitical realignments and sanctions",
  },

  // Escalation patterns
  {
    name: "protest_conflict",
    cause: { category: "geopolitics", keywords: ["protest", "demonstration", "uprising", "unrest"] },
    effect: { category: "military" },
    maxHours: 168,
    confidence: 60,
    sameCountryBoost: 20,
    explanation: "Civil unrest and protests can escalate into violent conflict",
  },
  {
    name: "economic_unrest",
    cause: { category: "economy", keywords: ["inflation", "recession", "collapse", "crisis"] },
    effect: { category: "geopolitics", keywords: ["protest", "unrest", "strike"] },
    maxHours: 240,
    confidence: 55,
    sameCountryBoost: 20,
    explanation: "Economic crises are frequent precursors to social unrest",
  },
];

// ─── Keyword check ─────────────────────────────────────────────────────────────

function matchesKeywords(event: GlobalEvent, keywords?: string[]): boolean {
  if (!keywords?.length) return true;
  const text = (event.title + " " + (event.description ?? "")).toLowerCase();
  const tokens = new Set(tokenize(text));
  return keywords.some((kw) => tokens.has(kw) || text.includes(kw));
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export const causalStrategy: CorrelationStrategy = {
  name: "causal",

  run(a: GlobalEvent, b: GlobalEvent, config: CorrelationEngineConfig): StrategyResult | null {
    if (!config.enableCausalPatterns) return null;

    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    const hoursApart = Math.abs(tA - tB) / 3_600_000;

    for (const rule of CAUSAL_RULES) {
      if (hoursApart > rule.maxHours) continue;

      // Determine which event is cause, which is effect (earlier = cause)
      const [cause, effect] =
        tA <= tB ? [a, b] : [b, a];

      if (
        cause.category === rule.cause.category &&
        effect.category === rule.effect.category &&
        matchesKeywords(cause, rule.cause.keywords) &&
        matchesKeywords(effect, rule.effect.keywords)
      ) {
        const sameCountry =
          cause.country && effect.country &&
          cause.country.toLowerCase() === effect.country.toLowerCase();

        const finalConfidence = Math.min(
          100,
          rule.confidence + (sameCountry ? rule.sameCountryBoost : 0),
        );

        const relationship =
          rule.name.includes("escalat") || rule.name.includes("protest_conflict")
            ? "escalation"
            : "cause_effect";

        return {
          relationship,
          score: finalConfidence,
          weight: 0.35,
          reason: `${rule.explanation} (${rule.name})`,
        };
      }
    }

    return null;
  },
};
