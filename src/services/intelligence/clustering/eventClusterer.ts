/**
 * Event Clusterer — deduplication + multi-source merging.
 *
 * Problem: GNews often returns 5 articles about the same event from different outlets.
 * Solution: Group articles by semantic similarity and merge them into a single
 *           IntelligenceEvent with multiple `clusterSources`.
 *
 * Algorithm:
 *   1. Exact URL deduplication (same story, different request)
 *   2. Title-similarity clustering (Jaccard on word tokens)
 *   3. Entity+country co-occurrence grouping
 *
 * Each cluster produces exactly one IntelligenceEvent.
 */
import type { IntelligenceItem } from "@/types";
import type { ClusterSource } from "../types";

/** Tokenize a title into lowercase word set for similarity comparison. */
function tokenize(text: string): Set<string> {
  const stopwords = new Set(["the", "a", "an", "and", "or", "in", "on", "at",
    "to", "for", "of", "is", "as", "by", "with", "from", "that", "this"]);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w)),
  );
}

/** Jaccard similarity between two word sets (0–1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Threshold above which two titles are considered the "same" story. */
const CLUSTER_THRESHOLD = 0.35;

interface Cluster {
  primary: IntelligenceItem;
  members: IntelligenceItem[];
}

/**
 * Group items into clusters of semantically similar articles.
 * The primary item is the first (usually most recent after sorting).
 */
export function clusterItems(items: IntelligenceItem[]): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (assigned.has(a.id)) continue;

    const cluster: Cluster = { primary: a, members: [a] };
    assigned.add(a.id);

    const tokensA = tokenize(a.title);

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (assigned.has(b.id)) continue;

      // Same URL → definitely same story
      if (a.url && b.url && a.url === b.url) {
        cluster.members.push(b);
        assigned.add(b.id);
        continue;
      }

      // Country match + high title similarity → likely same story
      const sameCountry = a.country && b.country && a.country === b.country;
      const tokensB = tokenize(b.title);
      const sim = jaccard(tokensA, tokensB);

      if (sim >= CLUSTER_THRESHOLD && (sameCountry || sim >= 0.5)) {
        cluster.members.push(b);
        assigned.add(b.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Convert a cluster's extra members into ClusterSource objects.
 * The primary article is not included (it becomes the IntelligenceEvent itself).
 */
export function buildClusterSources(cluster: Cluster): ClusterSource[] {
  return cluster.members
    .filter((m) => m.id !== cluster.primary.id)
    .map((m) => ({
      url: m.url ?? "",
      title: m.title,
      source: m.source,
      publishedAt: m.publishedAt,
    }));
}

/** Count total articles absorbed by clustering. */
export function countClustered(clusters: Cluster[]): number {
  return clusters.reduce((n, c) => n + Math.max(0, c.members.length - 1), 0);
}
