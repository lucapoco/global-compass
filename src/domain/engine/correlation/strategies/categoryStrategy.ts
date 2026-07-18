/**
 * Category Correlation Strategy
 *
 * Detects relationships based on event categories and provider agreement.
 *
 * Same-category match:
 *   Identical categories (both "military") → score 60
 *
 * Related-category matrix:
 *   Historically connected category pairs get a partial match.
 *   Example: earthquake + disaster, military + geopolitics, climate + disaster.
 *
 * Cross-provider agreement:
 *   When two different authoritative providers (USGS + EONET, or ACLED + GNews)
 *   report on similar events in the same location, confidence increases.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import type { CorrelationStrategy, CorrelationEngineConfig, StrategyResult } from "../types";

// ─── Category relationship matrix ─────────────────────────────────────────────

const RELATED_CATEGORIES: Array<[GlobalEventCategory, GlobalEventCategory, number]> = [
  // [catA, catB, relatedScore]
  ["earthquake", "disaster",    80],
  ["earthquake", "weather",     65],  // tsunami, storm surge
  ["earthquake", "economy",     50],
  ["military",   "geopolitics", 75],
  ["military",   "economy",     55],
  ["military",   "health",      60],  // conflict → humanitarian crisis
  ["climate",    "disaster",    75],
  ["climate",    "economy",     50],
  ["climate",    "health",      55],
  ["disaster",   "geopolitics", 60],
  ["disaster",   "economy",     60],
  ["disaster",   "health",      65],
  ["cyber",      "economy",     70],
  ["cyber",      "geopolitics", 65],
  ["cyber",      "technology",  60],
  ["energy",     "economy",     70],
  ["energy",     "geopolitics", 65],
  ["energy",     "climate",     55],
  ["health",     "economy",     55],
  ["health",     "geopolitics", 50],
  ["geopolitics","economy",     55],
];

// Quick lookup: key = sorted `${catA}|${catB}`
const RELATED_MAP = new Map<string, number>();
for (const [a, b, score] of RELATED_CATEGORIES) {
  const key = [a, b].sort().join("|");
  RELATED_MAP.set(key, score);
}

function relatedCategoryScore(a: GlobalEventCategory, b: GlobalEventCategory): number | null {
  const key = [a, b].sort().join("|");
  return RELATED_MAP.get(key) ?? null;
}

// ─── High-trust provider pairs ─────────────────────────────────────────────────

const AUTHORITATIVE_PROVIDERS: Set<GlobalEventProvider> = new Set([
  "usgs", "nasa_eonet", "acled", "world_bank",
]);

export const categoryStrategy: CorrelationStrategy = {
  name: "category",

  run(a: GlobalEvent, b: GlobalEvent, _config: CorrelationEngineConfig): StrategyResult | null {
    // ── Same category ────────────────────────────────────────────────────
    if (a.category === b.category) {
      // Cross-provider agreement bonus
      const crossProvider =
        a.provider !== b.provider &&
        (AUTHORITATIVE_PROVIDERS.has(a.provider) || AUTHORITATIVE_PROVIDERS.has(b.provider));

      const score = crossProvider ? 85 : 60;
      const relationship = crossProvider ? "cross_provider" : "same_category";
      const reason = crossProvider
        ? `Same category (${a.category}), confirmed by ${a.provider} and ${b.provider}`
        : `Same category (${a.category})`;

      return { relationship, score, weight: 0.18, reason };
    }

    // ── Related categories ───────────────────────────────────────────────
    const relScore = relatedCategoryScore(a.category, b.category);
    if (relScore !== null) {
      return {
        relationship: "same_category",
        score: relScore,
        weight: 0.15,
        reason: `Related categories (${a.category} ↔ ${b.category})`,
      };
    }

    return null;
  },
};
