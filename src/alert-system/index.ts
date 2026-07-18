/**
 * Global Alert & Crisis Management System — Public API
 *
 * This is the ONLY file other parts of Global Pulse should import from.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUICK REFERENCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Data loading:
 *   useAlertCenter()                    → { bundle, loading, error, refresh }
 *   refreshAlertCenter(force?)          → AlertCenterBundle (cached, 2 min TTL)
 *
 * Alerts:
 *   filterActiveAlerts(bundle)          → GlobalAlert[]
 *   filterCriticalAlerts(bundle)        → GlobalAlert[]
 *   filterResolvedAlerts(bundle)        → GlobalAlert[]
 *   filterAlertsByCountry(bundle, name) → GlobalAlert[]
 *   filterAlertsByRegion(bundle, name)  → GlobalAlert[]
 *   getAlertById(bundle, id)            → GlobalAlert | null
 *   getEventsForAlert(bundle, alert)    → GlobalEvent[]
 *   getAlertHistory(window)             → GlobalAlert[]  ("24h" | "7d" | "30d" | "all")
 *
 * Crisis:
 *   getCrisisBriefing(bundle, crisisId) → CrisisBriefing | null
 *   getAllCrisisBriefings(bundle)       → CrisisBriefing[]
 *
 * Notifications:
 *   useNotifications()                  → { notifications, unacknowledgedCount, acknowledge, dismiss }
 *
 * Watchlists:
 *   listWatchlist()                     → WatchlistEntry[]
 *   addWatchlistEntry(type, value)      → WatchlistEntry
 *   removeWatchlistEntry(id)            → void
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ALERT LEVEL SCALE
 * ─────────────────────────────────────────────────────────────────────────
 *   information → low → moderate → high → critical → extreme
 */

// ─── Service facade ───────────────────────────────────────────────────────────
export {
  refreshAlertCenter,
  invalidateAlertCenterCache,
  filterActiveAlerts,
  filterCriticalAlerts,
  filterResolvedAlerts,
  filterAlertsByCountry,
  filterAlertsByRegion,
  getAlertHistory,
  getCrisisBriefing,
  getAllCrisisBriefings,
  getAlertById,
  getEventsForAlert,
  type AlertCenterBundle,
} from "./services/alertCenterService";

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useAlertCenter, type UseAlertCenterResult } from "./hooks/useAlertCenter";
export { useNotifications } from "./hooks/useNotifications";

// ─── Pure engines (for advanced/custom integrations) ─────────────────────────
export { generateAlerts, getActiveAlerts, getCriticalAlerts, getResolvedAlerts, getAlertsForCountry, getAlertsForRegion } from "./alerts/alertEngine";
export { detectCrises, hasActiveCrisis, getMostSevereCrisis } from "./crisis/crisisDetector";
export { generateCrisisBriefing, generateAllCrisisBriefings } from "./briefings/crisisBriefing";
export { buildRiskHeatmap, aggregateHeatmapByRegion } from "./heatmap/heatmapEngine";
export { buildAlertAnalytics } from "./analytics/alertAnalytics";
export { alertHistoryStore } from "./history/alertHistory";
export {
  notificationStore,
  notificationsFromAlertDiff,
  notificationsFromWatchlistMatches,
  systemStatusNotification,
  aiReportReadyNotification,
} from "./notifications/notificationCenter";
export {
  listWatchlist,
  addWatchlistEntry,
  removeWatchlistEntry,
  matchEventsAgainstWatchlist,
} from "./watchlists/watchlistService";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  GlobalAlert,
  AlertLevel,
  AlertStatus,
  AlertSourceType,
  CrisisSituation,
  CrisisPattern,
  CrisisBriefing,
  AppNotification,
  NotificationType,
  WatchlistEntry,
  WatchlistEntryType,
  WatchlistMatch,
  HeatmapCell,
  RiskHeatmap,
  HistoryWindow,
  AlertAnalytics,
} from "./types";
export {
  ALERT_LEVEL_ORDER,
  ALERT_LEVEL_LABELS,
  ALERT_LEVEL_COLORS,
  CRISIS_PATTERN_LABELS,
  NOTIFICATION_TYPE_LABELS,
  sourceTypeForCategory,
} from "./types";
