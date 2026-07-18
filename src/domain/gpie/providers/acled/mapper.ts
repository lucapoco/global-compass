/**
 * ACLED → GPIE Category & Severity Mapper
 *
 * Translates ACLED's structured event classification into Global Pulse
 * intelligence categories and severity scores.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GPIE CATEGORIES (extended for ACLED)
 * ─────────────────────────────────────────────────────────────────────────
 *   military      Battles, explosions, remote violence
 *   geopolitics   Strategic developments, government actions
 *   civil_unrest  Riots, mob violence
 *   protest       Peaceful protests, demonstrations
 *   health        Attacks on healthcare, disease outbreaks tied to conflict
 *   general       Catch-all for unclassified events
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SEVERITY ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 *   Critical  fatalities > 50  OR  event_type = Battles/Violence
 *   High      fatalities 11–50  OR  Explosions/Remote violence
 *   Medium    fatalities 1–10   OR  Riots
 *   Low       fatalities 0       AND  Protests/Strategic
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONFIDENCE ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 *   ACLED assigns source_scale values:
 *     "International" → 90  (international news, highest reliability)
 *     "National"      → 80  (national media)
 *     "Subnational"   → 70  (local sources)
 *     "Other"         → 60
 *     (missing)       → 65  (conservative default)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PRIORITY SCORE (0–100)
 * ─────────────────────────────────────────────────────────────────────────
 *   Blends severity (60%), fatality signal (25%), and source quality (15%).
 *   A zero-fatality protest gets low priority; a 50-fatality battle is high.
 */
import type { GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcledMappedClassification {
  category: GlobalEventCategory;
  severity: GlobalEventSeverity;
  /** 0–100 confidence in the source quality. */
  confidence: number;
  /** 0–100 priority score for UI ranking. */
  priority: number;
  /** Human-readable GPIE label for this event type. */
  label: string;
}

// ─── Category mapping ─────────────────────────────────────────────────────────

const EVENT_TYPE_CATEGORY: Record<string, GlobalEventCategory> = {
  // Armed conflict
  "Battles": "military",
  "Violence against civilians": "military",
  "Explosions/Remote violence": "military",
  // Political instability
  "Strategic developments": "geopolitics",
  // Civil disorder
  "Riots": "general",
  // Mass mobilisation
  "Protests": "geopolitics",
};

const SUB_EVENT_CATEGORY_OVERRIDES: Record<string, GlobalEventCategory> = {
  "Peaceful protest": "geopolitics",
  "Protest with intervention": "geopolitics",
  "Excessive force against protesters": "military",
  "Mob violence": "general",
  "Armed clash": "military",
  "Air/drone strike": "military",
  "Shelling/artillery/missile attack": "military",
  "Suicide bomb": "military",
  "Remote explosive/landmine/IED": "military",
  "Chemical weapon": "military",
  "Non-violent transfer of territory": "geopolitics",
  "Headquarters or base established": "geopolitics",
  "Agreement": "geopolitics",
  "Abduction/forced disappearance": "military",
  "Sexual violence": "military",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  "Battles": "Armed Battle",
  "Violence against civilians": "Violence Against Civilians",
  "Explosions/Remote violence": "Explosion / Remote Attack",
  "Strategic developments": "Strategic Development",
  "Riots": "Civil Unrest / Riot",
  "Protests": "Protest / Demonstration",
};

// ─── Severity mapping ─────────────────────────────────────────────────────────

function deriveSeverity(eventType: string, fatalities: number): GlobalEventSeverity {
  if (fatalities > 50) return "critical";
  if (eventType === "Battles" || eventType === "Violence against civilians") {
    if (fatalities > 10) return "critical";
    return "high";
  }
  if (eventType === "Explosions/Remote violence") {
    if (fatalities > 10) return "critical";
    if (fatalities > 0) return "high";
    return "medium";
  }
  if (eventType === "Riots") {
    if (fatalities > 10) return "high";
    return "medium";
  }
  if (fatalities > 10) return "high";
  if (fatalities > 0) return "medium";
  return "low";
}

// ─── Confidence mapping ───────────────────────────────────────────────────────

const SOURCE_SCALE_CONFIDENCE: Record<string, number> = {
  "International": 90,
  "National": 80,
  "Subnational": 70,
  "Regional": 75,
  "Other": 60,
};

function deriveConfidence(sourceScale?: string): number {
  if (!sourceScale) return 65;
  return SOURCE_SCALE_CONFIDENCE[sourceScale] ?? 65;
}

// ─── Priority score ───────────────────────────────────────────────────────────

const SEVERITY_BASE: Record<GlobalEventSeverity, number> = {
  critical: 95,
  high: 70,
  medium: 40,
  low: 15,
};

function derivePriority(severity: GlobalEventSeverity, fatalities: number, confidence: number): number {
  const severityBase = SEVERITY_BASE[severity];
  const fatalityBonus = Math.min(fatalities * 0.5, 25);
  const raw = severityBase * 0.6 + fatalityBonus * 0.25 + confidence * 0.15;
  return Math.round(Math.min(100, raw));
}

// ─── Public mapper ────────────────────────────────────────────────────────────

/**
 * Map ACLED event fields to GPIE classification.
 *
 * @param eventType     ACLED top-level event type
 * @param subEventType  ACLED sub-event type (more specific)
 * @param fatalities    Number of fatalities (used for severity calibration)
 * @param sourceScale   ACLED source scale string ("International", "National", etc.)
 */
export function mapAcledEvent(
  eventType: string,
  subEventType: string,
  fatalities: number,
  sourceScale?: string,
): AcledMappedClassification {
  const category =
    SUB_EVENT_CATEGORY_OVERRIDES[subEventType] ??
    EVENT_TYPE_CATEGORY[eventType] ??
    "geopolitics";

  const severity = deriveSeverity(eventType, fatalities);
  const confidence = deriveConfidence(sourceScale);
  const priority = derivePriority(severity, fatalities, confidence);
  const label = EVENT_TYPE_LABEL[eventType] ?? eventType;

  return { category, severity, confidence, priority, label };
}
