/**
 * Global Alert & Crisis Management System — Type Definitions
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ─────────────────────────────────────────────────────────────────────────
 *   • Alerts are DERIVED from real GlobalEvents — never fabricated.
 *   • Every alert must cite its supporting event IDs.
 *   • Every alert must expose confidence + an explanation.
 *   • Crisis situations are DETECTED from patterns in existing alerts/events,
 *     never predicted. No forward-looking claims are made anywhere.
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity, GlobalEventProvider } from "@/domain/models/GlobalEvent";

// ─── Alert levels ─────────────────────────────────────────────────────────────

export type AlertLevel = "information" | "low" | "moderate" | "high" | "critical" | "extreme";

export const ALERT_LEVEL_ORDER: AlertLevel[] = ["information", "low", "moderate", "high", "critical", "extreme"];

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  information: "Information",
  low:         "Low",
  moderate:    "Moderate",
  high:        "High",
  critical:    "Critical",
  extreme:     "Extreme",
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  information: "#3b82f6",
  low:         "#22c55e",
  moderate:    "#eab308",
  high:        "#f97316",
  critical:    "#ef4444",
  extreme:     "#991b1b",
};

/** Maps GlobalEvent severity to a baseline alert level before adjustments. */
export const SEVERITY_TO_ALERT_LEVEL: Record<GlobalEventSeverity, AlertLevel> = {
  low:      "low",
  medium:   "moderate",
  high:     "high",
  critical: "critical",
};

// ─── Alert status ─────────────────────────────────────────────────────────────

export type AlertStatus = "active" | "escalated" | "resolved" | "expired";

// ─── Alert source category (maps 1:1 with GlobalEventCategory but named for UI clarity) ──

export type AlertSourceType =
  | "breaking_news"
  | "earthquake"
  | "weather"
  | "wildfire"
  | "flood"
  | "volcano"
  | "conflict"
  | "cyber"
  | "economic"
  | "health"
  | "energy"
  | "other";

const CATEGORY_TO_SOURCE_TYPE: Record<GlobalEventCategory, AlertSourceType> = {
  geopolitics: "conflict",
  military:    "conflict",
  economy:     "economic",
  technology:  "cyber",
  energy:      "energy",
  climate:     "weather",
  disaster:    "wildfire",
  cyber:       "cyber",
  health:      "health",
  earthquake:  "earthquake",
  weather:     "weather",
  country:     "other",
  general:     "breaking_news",
};

export function sourceTypeForCategory(category: GlobalEventCategory): AlertSourceType {
  return CATEGORY_TO_SOURCE_TYPE[category] ?? "other";
}

// ─── Global Alert ─────────────────────────────────────────────────────────────

export interface GlobalAlert {
  id: string;
  title: string;
  summary: string;

  level: AlertLevel;
  status: AlertStatus;
  sourceType: AlertSourceType;
  category: GlobalEventCategory;

  severity: GlobalEventSeverity;
  /** 0–100. How certain we are this alert reflects a real, significant situation. */
  confidence: number;
  /** 0–100. Composite urgency used for sorting the alert feed. */
  priority: number;
  /** 0–100. Aggregated risk score from supporting events. */
  riskScore: number;

  /** Distinct providers that reported supporting evidence. */
  providers: GlobalEventProvider[];
  /** How many distinct providers confirm this alert (multi-source validation). */
  sourceCount: number;
  /** True when ≥2 independent providers report on the same situation. */
  multiSourceConfirmed: boolean;

  supportingEventIds: string[];
  affectedCountries: string[];
  affectedRegions: string[];

  explanation: string;

  firstSeenAt: string;
  lastUpdatedAt: string;
  resolvedAt?: string;
}

// ─── Crisis situation ─────────────────────────────────────────────────────────

export type CrisisPattern =
  | "earthquake_cluster"
  | "conflict_escalation"
  | "disaster_cluster"
  | "extreme_weather_multi_country"
  | "cyber_infrastructure"
  | "regional_convergence";

export const CRISIS_PATTERN_LABELS: Record<CrisisPattern, string> = {
  earthquake_cluster:             "Earthquake Cluster",
  conflict_escalation:            "Conflict Escalation",
  disaster_cluster:               "Natural Disaster Cluster",
  extreme_weather_multi_country:  "Extreme Weather (Multi-Country)",
  cyber_infrastructure:           "Cyber Infrastructure Threat",
  regional_convergence:           "Regional Risk Convergence",
};

export interface CrisisSituation {
  id: string;
  pattern: CrisisPattern;
  title: string;
  level: AlertLevel;

  affectedCountries: string[];
  affectedRegions: string[];

  alertIds: string[];
  supportingEventIds: string[];

  confidence: number;
  riskScore: number;

  reason: string;
  detectedAt: string;
  active: boolean;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "new_alert"
  | "alert_escalation"
  | "alert_resolved"
  | "new_critical_event"
  | "ai_report_ready"
  | "system_status"
  | "watchlist_match";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_alert:          "New Alert",
  alert_escalation:   "Alert Escalation",
  alert_resolved:     "Alert Resolved",
  new_critical_event: "New Critical Event",
  ai_report_ready:    "AI Report Ready",
  system_status:      "System Status",
  watchlist_match:    "Watchlist Match",
};

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  level: AlertLevel;
  relatedAlertId?: string;
  relatedEventIds?: string[];
  createdAt: string;
  acknowledged: boolean;
  dismissed: boolean;
}

// ─── Watchlists ───────────────────────────────────────────────────────────────

export type WatchlistEntryType = "country" | "region" | "topic" | "category" | "keyword" | "organization";

export interface WatchlistEntry {
  id: string;
  userId?: string;
  type: WatchlistEntryType;
  value: string;          // e.g. "France", "Europe", "cyberattack", "military"
  label: string;
  createdAt: string;
}

export interface WatchlistMatch {
  entry: WatchlistEntry;
  event: GlobalEvent;
  matchReason: string;
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  lat: number;
  lng: number;
  countryOrRegion: string;
  intensity: number;      // 0–1
  eventCount: number;
  riskScore: number;
  trend: "up" | "down" | "stable";
}

export interface RiskHeatmap {
  cells: HeatmapCell[];
  maxIntensity: number;
  generatedAt: string;
}

// ─── Crisis briefing ──────────────────────────────────────────────────────────

export interface CrisisBriefing {
  crisisId: string;
  title: string;
  situationOverview: string;
  affectedRegions: string[];
  supportingEvidence: string[];
  relatedEventIds: string[];
  currentTrend: "escalating" | "stable" | "de-escalating" | "insufficient_data";
  confidence: number;
  recommendedInvestigationAreas: string[];
  generatedAt: string;
}

// ─── History windows ──────────────────────────────────────────────────────────

export type HistoryWindow = "24h" | "7d" | "30d" | "all";

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AlertAnalytics {
  totalActive: number;
  totalResolved: number;
  totalCritical: number;
  totalExtreme: number;
  byLevel: Record<AlertLevel, number>;
  bySourceType: Partial<Record<AlertSourceType, number>>;
  topCountries: Array<{ country: string; count: number }>;
  topRegions: Array<{ region: string; count: number }>;
  avgConfidence: number;
  multiSourceRate: number;   // 0–1 fraction confirmed by 2+ providers
  calculatedAt: string;
}
