/**
 * Keyword Similarity Strategy
 *
 * Uses Jaccard similarity over tokenized event titles to detect events
 * reporting on the same or closely related subject.
 *
 * Two events about "Japan earthquake infrastructure damage" and
 * "Japan power grid failure after earthquake" will share tokens
 * ["japan", "earthquake"] and score ~0.25 — above the default threshold.
 *
 * Score curve:
 *   similarity ≥ 0.5  → score 90 (near-duplicate)
 *   similarity ≥ 0.3  → score 70
 *   similarity ≥ 0.15 → score 50
 *
 * Tags are also considered: events sharing 2+ tags receive a bonus.
 */
import { tokenize, jaccardSimilarity } from "@/domain/utils/text";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { CorrelationStrategy, CorrelationEngineConfig, StrategyResult } from "../types";

function sharedTagCount(a: GlobalEvent, b: GlobalEvent): number {
  if (!a.tags.length || !b.tags.length) return 0;
  const setB = new Set(b.tags.map((t) => t.toLowerCase()));
  return a.tags.filter((t) => setB.has(t.toLowerCase())).length;
}

export const keywordStrategy: CorrelationStrategy = {
  name: "keyword_similarity",

  run(a: GlobalEvent, b: GlobalEvent, config: CorrelationEngineConfig): StrategyResult | null {
    const tokA = tokenize(a.title + " " + (a.description ?? ""));
    const tokB = tokenize(b.title + " " + (b.description ?? ""));
    const similarity = jaccardSimilarity(tokA, tokB);

    if (similarity < config.minKeywordSimilarity) {
      // Still check tag overlap as a fallback
      const sharedTags = sharedTagCount(a, b);
      if (sharedTags >= 2) {
        return {
          relationship: "keyword_similarity",
          score: 40,
          weight: 0.15,
          reason: `${sharedTags} shared topic tags`,
        };
      }
      return null;
    }

    let score: number;
    let label: string;
    if (similarity >= 0.5) {
      score = 90;
      label = "near-duplicate subject";
    } else if (similarity >= 0.3) {
      score = 70;
      label = "closely related subject";
    } else {
      score = 50;
      label = "overlapping keywords";
    }

    const sharedTags = sharedTagCount(a, b);
    const bonus = Math.min(sharedTags * 5, 10);

    return {
      relationship: "keyword_similarity",
      score: Math.min(100, score + bonus),
      weight: 0.20,
      reason: `Similar subject (${Math.round(similarity * 100)}% ${label})`,
    };
  },
};
