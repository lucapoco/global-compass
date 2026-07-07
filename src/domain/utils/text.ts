const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "is", "are", "was", "were",
  "with", "by", "as", "it", "its", "this", "that", "from", "after", "before", "over", "into",
  "amid", "amid.", "than", "but", "be", "has", "have", "had", "will", "new", "says",
]);

/** Lowercase, strip punctuation, collapse whitespace — used for near-duplicate title dedupe. */
export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, "")
    .trim()
    .slice(0, 140);
}

/** Tokenizes text into meaningful lowercase keywords (stopwords + short tokens removed). */
export function tokenize(text: string): string[] {
  return normalizeTitleKey(text)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Jaccard similarity (0-1) between two keyword sets — used for keyword-based correlation. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Deterministic short id derived from arbitrary strings (no crypto dependency needed). */
export function stableIdFrom(...parts: (string | number | undefined)[]): string {
  const raw = parts.filter((p) => p !== undefined && p !== null).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
