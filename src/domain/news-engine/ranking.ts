/**
 * Relevance ranking for aggregated news stories.
 *
 * relevance = recency decay × source reliability × severity weight × corroboration bonus
 *
 * Multi-source corroboration (the same story confirmed by 2+ independent
 * providers) is treated as a meaningful positive signal — exactly like
 * multi-source validation in the Alert System — since it indicates the
 * story is significant enough to be covered widely, not a single outlet's
 * unverified report.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { SEVERITY_WEIGHT } from "@/domain/services/event-engine/scoring";
import { getProviderReliability } from "@/domain/gpie/scoring/sourceReliability";
import { ageMs } from "@/domain/utils/time";
import type { DedupGroup } from "./dedup";

const HALF_LIFE_MS = 8 * 60 * 60 * 1000; // relevance halves every 8h of age

function recencyDecay(timestamp: string): number {
  const age = ageMs(timestamp);
  return Math.pow(0.5, age / HALF_LIFE_MS);
}

function corroborationBonus(count: number): number {
  if (count >= 4) return 1.35;
  if (count === 3) return 1.25;
  if (count === 2) return 1.12;
  return 1;
}

export function computeRelevanceScore(group: DedupGroup): number {
  const event: GlobalEvent = group.canonical;
  const reliability = getProviderReliability(event.provider) / 100;
  const severity = SEVERITY_WEIGHT[event.severity] / 100;
  const recency = recencyDecay(event.timestamp);
  const corroboration = corroborationBonus(new Set(group.members.map((m) => m.provider)).size);

  const raw = (0.32 * reliability + 0.38 * severity + 0.3 * recency) * 100 * corroboration;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function rankGroups(groups: DedupGroup[]): DedupGroup[] {
  return [...groups].sort((a, b) => computeRelevanceScore(b) - computeRelevanceScore(a));
}
