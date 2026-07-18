/**
 * Time Proximity Strategy
 *
 * Rewards events that happened close together in time.
 * A smaller time gap is a stronger correlation signal — events
 * happening within hours of each other in the same area are almost
 * certainly related.
 *
 * Score decay curve:
 *   ≤ 1 hour  → score 95
 *   ≤ 6 hours → score 80
 *   ≤ 24 h    → score 65
 *   ≤ 72 h    → score 45
 *   ≤ maxH    → score 25
 *   > maxH    → null (no match)
 */
import { hoursBetween } from "@/domain/utils/time";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { CorrelationStrategy, CorrelationEngineConfig, StrategyResult } from "../types";

function timeLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes apart`;
  if (hours < 24) return `${Math.round(hours)} hours apart`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} apart`;
}

export const timeStrategy: CorrelationStrategy = {
  name: "time_proximity",

  run(a: GlobalEvent, b: GlobalEvent, config: CorrelationEngineConfig): StrategyResult | null {
    const hours = hoursBetween(a.timestamp, b.timestamp);
    if (hours > config.maxHoursApart) return null;

    let score: number;
    if (hours <= 1) score = 95;
    else if (hours <= 6) score = 80;
    else if (hours <= 24) score = 65;
    else if (hours <= 72) score = 45;
    else score = 25;

    return {
      relationship: "time_proximity",
      score,
      weight: 0.25,
      reason: `Published ${timeLabel(hours)}`,
    };
  },
};
