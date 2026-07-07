/**
 * Category Engine — weighted multi-category detection.
 *
 * Scans event text against all category keyword rules and returns:
 *   - `category`: the dominant category (highest score)
 *   - `categories`: all categories with a score above threshold (multi-label)
 *   - `confidence`: 0–100 score reflecting how clearly categorized the event is
 */
import type { ExtendedCategory } from "../types";
import { CATEGORY_RULES } from "./dictionaries";

interface CategoryScore {
  category: ExtendedCategory;
  score: number;
}

const MULTI_LABEL_THRESHOLD = 3; // min score to include in `categories`

/** Score a single text blob against all category keyword rules. */
function scoreCategories(text: string): CategoryScore[] {
  const norm = text.toLowerCase();
  const scores: CategoryScore[] = [];

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.length === 0) continue;
    let score = 0;
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) {
        score += rule.weight;
      }
    }
    if (score > 0) {
      scores.push({ category: rule.category, score });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Detect all categories for an event.
 * Returns primary category, all matched categories, and a confidence score.
 */
export function detectCategories(text: string): {
  category: ExtendedCategory;
  categories: ExtendedCategory[];
  confidence: number;
} {
  const scores = scoreCategories(text);

  if (scores.length === 0) {
    return { category: "general", categories: ["general"], confidence: 20 };
  }

  const top = scores[0];
  const allAboveThreshold = scores
    .filter((s) => s.score >= MULTI_LABEL_THRESHOLD)
    .map((s) => s.category);

  // Confidence: ratio of top score to maximum possible (weight * 3 hits = strong signal)
  const maxPossible = top.score + 15;
  const confidence = Math.min(95, Math.round((top.score / maxPossible) * 100));

  return {
    category: top.category,
    categories: allAboveThreshold.length > 0 ? allAboveThreshold : [top.category],
    confidence,
  };
}

/** Return a human-readable label for an ExtendedCategory. */
export function categoryLabel(cat: ExtendedCategory): string {
  const labels: Record<ExtendedCategory, string> = {
    geopolitics: "Geopolitics",
    military: "Military",
    economy: "Economy",
    finance: "Finance",
    technology: "Technology",
    energy: "Energy",
    cybersecurity: "Cybersecurity",
    climate: "Climate",
    weather: "Weather",
    earthquake: "Earthquake",
    disaster: "Disaster",
    health: "Health",
    transportation: "Transportation",
    infrastructure: "Infrastructure",
    migration: "Migration",
    crime: "Crime",
    science: "Science",
    diplomacy: "Diplomacy",
    space: "Space",
    environment: "Environment",
    general: "General",
    unknown: "Unknown",
  };
  return labels[cat] ?? "General";
}

/** All available categories for filter UI. */
export const ALL_CATEGORIES: ExtendedCategory[] = [
  "geopolitics", "military", "economy", "finance", "technology", "energy",
  "cybersecurity", "climate", "weather", "earthquake", "disaster", "health",
  "transportation", "infrastructure", "migration", "crime", "science",
  "diplomacy", "space", "environment", "general",
];
