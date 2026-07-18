/**
 * Cross-provider story deduplication.
 *
 * The EventEngine's own `dedupeEvents()` only removes same-provider exact/
 * near-duplicate titles. The News Engine goes further: the same real-world
 * story is frequently reported — with different headlines — by GNews,
 * GDELT, and multiple RSS broadcasters simultaneously. We group stories
 * published within a rolling time window whose title token sets overlap
 * significantly (Jaccard similarity), and collapse each group into a single
 * "corroborated" story, keeping the most reliable/richest source as the
 * canonical version.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { tokenize, jaccardSimilarity } from "@/domain/utils/text";
import { getProviderReliability } from "@/domain/gpie/scoring/sourceReliability";

const SIMILARITY_THRESHOLD = 0.42;
const TIME_WINDOW_MS = 36 * 60 * 60 * 1000; // 36h — broadcasters often lag each other by up to a day

export interface DedupGroup {
  canonical: GlobalEvent;
  members: GlobalEvent[];
}

function pickCanonical(members: GlobalEvent[]): GlobalEvent {
  return [...members].sort((a, b) => {
    const reliabilityDiff = getProviderReliability(b.provider) - getProviderReliability(a.provider);
    if (reliabilityDiff !== 0) return reliabilityDiff;
    const lengthDiff = (b.description?.length ?? 0) - (a.description?.length ?? 0);
    if (lengthDiff !== 0) return lengthDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  })[0];
}

/** Groups near-duplicate stories across providers into `DedupGroup`s. */
export function groupDuplicateStories(events: GlobalEvent[]): DedupGroup[] {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const tokensById = new Map<string, string[]>();
  for (const e of sorted) tokensById.set(e.id, tokenize(e.title));

  const assigned = new Set<string>();
  const groups: DedupGroup[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (assigned.has(a.id)) continue;

    const members: GlobalEvent[] = [a];
    assigned.add(a.id);
    const tokensA = tokensById.get(a.id)!;
    const timeA = new Date(a.timestamp).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (assigned.has(b.id)) continue;

      const timeB = new Date(b.timestamp).getTime();
      if (timeB - timeA > TIME_WINDOW_MS) break; // sorted by time — no later candidates can match

      const tokensB = tokensById.get(b.id)!;
      if (jaccardSimilarity(tokensA, tokensB) >= SIMILARITY_THRESHOLD) {
        members.push(b);
        assigned.add(b.id);
      }
    }

    groups.push({ canonical: pickCanonical(members), members });
  }

  return groups;
}
