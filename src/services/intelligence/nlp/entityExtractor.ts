/**
 * Entity Extractor — lightweight client-side NLP.
 *
 * Uses keyword dictionaries and regex heuristics to detect named entities
 * (countries, leaders, organizations, etc.) in raw text. No external API required.
 */
import type { EntityGroup } from "../types";
import {
  ENTITY_LEADERS,
  ENTITY_ORGANIZATIONS,
  ENTITY_ALLIANCES,
  ENTITY_COMPANIES,
  ENTITY_CONFLICTS,
  ENTITY_TECHNOLOGIES,
  ENTITY_COMMODITIES,
  ENTITY_INFRASTRUCTURE,
  COUNTRY_COORDS,
  MAJOR_CITIES,
} from "./dictionaries";

/** Normalize text for matching (lowercase, collapse whitespace). */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** Extract entities that appear in the given text from a dictionary list. */
function findMatches(text: string, list: string[]): string[] {
  const norm = normalize(text);
  const found: string[] = [];
  for (const entry of list) {
    if (norm.includes(entry.toLowerCase())) {
      found.push(entry);
    }
  }
  return [...new Set(found)];
}

/** Extract all country names mentioned in the text. */
function extractCountries(text: string): string[] {
  const norm = normalize(text);
  const countries: string[] = [];
  for (const country of Object.keys(COUNTRY_COORDS)) {
    // Use word-boundary-ish matching: surrounded by space/punctuation
    const rx = new RegExp(`(?:^|[\\s,.:;'"(])${country.toLowerCase()}(?:$|[\\s,.:;'")])`, "i");
    if (rx.test(norm)) {
      countries.push(country);
    }
  }
  return [...new Set(countries)].slice(0, 6);
}

/** Extract major city names from text. */
function extractCities(text: string): string[] {
  const norm = normalize(text);
  const found: string[] = [];
  for (const city of MAJOR_CITIES) {
    if (norm.includes(city)) {
      // Capitalize the city name for display
      found.push(city.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
    }
  }
  return [...new Set(found)].slice(0, 4);
}

/** Extract significant keywords (nouns, technical terms) not in the entity lists. */
export function extractKeywords(text: string): string[] {
  const norm = normalize(text);
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "that", "this", "these", "those",
    "it", "its", "they", "them", "their", "he", "she", "his", "her", "we",
    "our", "us", "you", "your", "new", "says", "said", "after", "over",
    "amid", "due", "amid", "into", "about", "between", "through", "during",
    "before", "more", "than", "first", "other", "also",
  ]);

  const words = norm
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopwords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  // Sort by frequency + length, take top 8
  return Array.from(freq.entries())
    .filter(([, count]) => count >= 1)
    .sort(([a, ac], [b, bc]) => bc - ac || b.length - a.length)
    .slice(0, 8)
    .map(([w]) => w);
}

/**
 * Run full entity extraction on combined title + description text.
 * Returns an EntityGroup with up to a few entries per category.
 */
export function extractEntities(text: string): EntityGroup {
  return {
    countries: extractCountries(text),
    cities: extractCities(text),
    leaders: findMatches(text, ENTITY_LEADERS).slice(0, 4).map(capitalize),
    organizations: findMatches(text, ENTITY_ORGANIZATIONS).slice(0, 4).map(capitalize),
    companies: findMatches(text, ENTITY_COMPANIES).slice(0, 4).map(capitalize),
    alliances: findMatches(text, ENTITY_ALLIANCES).slice(0, 3).map((s) => s.toUpperCase()),
    conflicts: findMatches(text, ENTITY_CONFLICTS).slice(0, 3).map(capitalize),
    infrastructure: findMatches(text, ENTITY_INFRASTRUCTURE).slice(0, 3).map(capitalize),
    technologies: findMatches(text, ENTITY_TECHNOLOGIES).slice(0, 3).map(capitalize),
    commodities: findMatches(text, ENTITY_COMMODITIES).slice(0, 4).map(capitalize),
    disasters: [],
  };
}

function capitalize(s: string): string {
  return s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Get the most mentioned country in the text (primary country). */
export function detectPrimaryCountry(text: string): string | undefined {
  const found = extractCountries(text);
  if (!found.length) return undefined;
  // Prefer the first mentioned country (appears earliest in text)
  const norm = normalize(text);
  return found.sort((a, b) => norm.indexOf(a.toLowerCase()) - norm.indexOf(b.toLowerCase()))[0];
}
