export { locationStrategy } from "./locationStrategy";
export { timeStrategy } from "./timeStrategy";
export { keywordStrategy } from "./keywordStrategy";
export { categoryStrategy } from "./categoryStrategy";
export { causalStrategy } from "./causalStrategy";

import { locationStrategy } from "./locationStrategy";
import { timeStrategy } from "./timeStrategy";
import { keywordStrategy } from "./keywordStrategy";
import { categoryStrategy } from "./categoryStrategy";
import { causalStrategy } from "./causalStrategy";
import type { CorrelationStrategy } from "../types";

/** All strategies in priority order (highest-weight strategies first). */
export const ALL_STRATEGIES: CorrelationStrategy[] = [
  causalStrategy,    // highest weight (0.35) — explicit causal chains
  locationStrategy,  // weight 0.35 — geography is a strong signal
  timeStrategy,      // weight 0.25 — recency matters
  categoryStrategy,  // weight 0.18 — category correlation
  keywordStrategy,   // weight 0.20 — keyword overlap
];
