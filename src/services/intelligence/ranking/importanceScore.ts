/**
 * Importance Score — 0–100 composite ranking.
 *
 * Factors (all additive, capped at 100):
 *   • Recency (up to 30 pts): events from the last hour score higher
 *   • Severity (up to 30 pts): critical > high > medium > low
 *   • Country importance (up to 20 pts): geopolitically significant countries
 *   • Category (up to 10 pts): military/geopolitics/cyber > general
 *   • Cluster size (up to 5 pts): more sources = more important
 *   • Live data bonus (5 pts): live > cached > demo
 */
import type { EventSeverity, ExtendedCategory } from "../types";
import { COUNTRY_IMPORTANCE } from "../nlp/dictionaries";
import { SEVERITY_NUMERIC } from "./severityEngine";

interface ImportanceInput {
  severity: EventSeverity;
  category: ExtendedCategory;
  categories: ExtendedCategory[];
  country?: string;
  publishedAt: string;
  articleCount: number;
  isLive: boolean;
  confidence: number;
}

/** Points per category (reflects intelligence priority). */
const CATEGORY_IMPORTANCE: Partial<Record<ExtendedCategory, number>> = {
  military: 10,
  cybersecurity: 9,
  geopolitics: 9,
  earthquake: 8,
  disaster: 8,
  health: 7,
  energy: 7,
  finance: 7,
  economy: 6,
  climate: 6,
  diplomacy: 6,
  weather: 5,
  technology: 5,
  transportation: 4,
  infrastructure: 5,
  crime: 4,
  migration: 4,
  environment: 3,
  science: 3,
  space: 4,
  general: 1,
  unknown: 0,
};

/** Calculate recency bonus: 30 pts for < 1 h, tapering to 0 at > 7 days. */
function recencyScore(publishedAt: string): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageH = ageMs / (1000 * 60 * 60);
  if (ageH < 1)  return 30;
  if (ageH < 6)  return 25;
  if (ageH < 24) return 18;
  if (ageH < 48) return 10;
  if (ageH < 168) return 4; // within 7 days
  return 0;
}

/** Calculate the composite 0–100 importance score. */
export function computeImportance(input: ImportanceInput): number {
  let score = 0;

  // Recency (0–30)
  score += recencyScore(input.publishedAt);

  // Severity (0–30)
  const sevPts = { critical: 30, high: 20, medium: 10, low: 3 } as const;
  score += sevPts[input.severity] ?? 0;

  // Country importance (0–20)
  const countryBonus = input.country ? (COUNTRY_IMPORTANCE[input.country] ?? 0) : 0;
  score += countryBonus;

  // Category (0–10)
  score += CATEGORY_IMPORTANCE[input.category] ?? 1;

  // Multi-category bonus (up to 3 pts for having multiple significant categories)
  const multiBonus = Math.min(3, Math.max(0, input.categories.length - 1));
  score += multiBonus;

  // Cluster/article count (0–5)
  if (input.articleCount >= 5) score += 5;
  else if (input.articleCount >= 3) score += 3;
  else if (input.articleCount >= 2) score += 1;

  // Live data bonus (0–5)
  if (input.isLive) score += 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Derive a confidence score (0–100) from available data quality signals. */
export function computeConfidence(input: {
  isLive: boolean;
  articleCount: number;
  categoryConfidence: number;
  hasUrl: boolean;
  hasImage: boolean;
}): number {
  let score = input.categoryConfidence * 0.5; // base: category clarity (0–47)

  if (input.isLive) score += 20;
  else score += 10;

  if (input.articleCount >= 3) score += 15;
  else if (input.articleCount >= 2) score += 7;

  if (input.hasUrl) score += 10;
  if (input.hasImage) score += 5;

  return Math.min(98, Math.max(10, Math.round(score)));
}

/** Sort comparator: by importance desc, then severity desc, then newest. */
export function byImportanceDesc(
  a: { importance: number; severity: EventSeverity; publishedAt: string },
  b: { importance: number; severity: EventSeverity; publishedAt: string },
): number {
  if (b.importance !== a.importance) return b.importance - a.importance;
  const ds = SEVERITY_NUMERIC[b.severity] - SEVERITY_NUMERIC[a.severity];
  if (ds !== 0) return ds;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}
