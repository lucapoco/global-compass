/**
 * Alert Center Service — Main Facade
 *
 * The single entry point for all Global Alert & Crisis Management System
 * functionality. UI code should only import from here (or the package
 * barrel `src/alert-system/index.ts`), never reach into sub-modules.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PIPELINE ON EVERY CALL TO refreshAlertCenter()
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Load events from EventEngine (shared cache with the rest of the app)
 *   2. Generate alerts (alertEngine)
 *   3. Record snapshot + diff against previous state (alertHistory)
 *   4. Detect crises (crisisDetector)
 *   5. Generate notifications from the diff (notificationCenter)
 *   6. Match events against the user's watchlist
 *   7. Cache the bundle for CACHE_TTL to avoid redundant recomputation
 */
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { generateAlerts, getActiveAlerts, getCriticalAlerts, getResolvedAlerts, getAlertsForCountry, getAlertsForRegion } from "../alerts/alertEngine";
import { detectCrises, hasActiveCrisis, getMostSevereCrisis } from "../crisis/crisisDetector";
import { generateAllCrisisBriefings, generateCrisisBriefing } from "../briefings/crisisBriefing";
import { buildRiskHeatmap } from "../heatmap/heatmapEngine";
import { buildAlertAnalytics } from "../analytics/alertAnalytics";
import { alertHistoryStore } from "../history/alertHistory";
import { notificationsFromAlertDiff, notificationsFromWatchlistMatches, notificationStore } from "../notifications/notificationCenter";
import { listWatchlist, matchEventsAgainstWatchlist } from "../watchlists/watchlistService";
import { REGION_COUNTRIES } from "@/domain/decision/stability/stabilityEngine";
import type {
  GlobalAlert, CrisisSituation, CrisisBriefing, RiskHeatmap, AlertAnalytics, HistoryWindow,
} from "../types";

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface AlertCenterBundle {
  events: GlobalEvent[];
  alerts: GlobalAlert[];
  crises: CrisisSituation[];
  heatmap: RiskHeatmap;
  analytics: AlertAnalytics;
  hasCrisis: boolean;
  mostSevereCrisis: CrisisSituation | null;
  generatedAt: string;
}

let _cache: AlertCenterBundle | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 2 * 60_000; // 2 minutes — alerts should feel near-live

export async function refreshAlertCenter(force = false): Promise<AlertCenterBundle> {
  if (!force && _cache && Date.now() < _cacheExpiry) return _cache;

  const events = await eventEngine.loadAll();
  const alerts = generateAlerts(events);
  const crises = detectCrises(alerts);
  const heatmap = buildRiskHeatmap(events);
  const analytics = buildAlertAnalytics(alerts);

  // Diff against previous state → notifications
  const diff = alertHistoryStore.record(alerts);
  const diffNotifications = notificationsFromAlertDiff(diff);
  notificationStore.push(diffNotifications);

  // Watchlist matching → personalized notifications
  try {
    const watchlist = await listWatchlist();
    if (watchlist.length > 0) {
      const recentEvents = events.filter(
        (e) => Date.now() - new Date(e.timestamp).getTime() <= 6 * 3_600_000,
      );
      const matches = matchEventsAgainstWatchlist(watchlist, recentEvents, REGION_COUNTRIES);
      notificationStore.push(notificationsFromWatchlistMatches(matches));
    }
  } catch (err) {
    console.warn("[alertCenterService] watchlist matching failed", err);
  }

  const bundle: AlertCenterBundle = {
    events,
    alerts,
    crises,
    heatmap,
    analytics,
    hasCrisis: hasActiveCrisis(crises),
    mostSevereCrisis: getMostSevereCrisis(crises),
    generatedAt: new Date().toISOString(),
  };

  _cache = bundle;
  _cacheExpiry = Date.now() + CACHE_TTL;
  return bundle;
}

export function invalidateAlertCenterCache(): void {
  _cache = null;
  _cacheExpiry = 0;
}

// ─── Convenience accessors (operate on the cached bundle, no re-fetch) ────────

export function filterActiveAlerts(bundle: AlertCenterBundle): GlobalAlert[] {
  return getActiveAlerts(bundle.alerts);
}

export function filterCriticalAlerts(bundle: AlertCenterBundle): GlobalAlert[] {
  return getCriticalAlerts(bundle.alerts);
}

export function filterResolvedAlerts(bundle: AlertCenterBundle): GlobalAlert[] {
  return getResolvedAlerts(bundle.alerts);
}

export function filterAlertsByCountry(bundle: AlertCenterBundle, country: string): GlobalAlert[] {
  return getAlertsForCountry(bundle.alerts, country);
}

export function filterAlertsByRegion(bundle: AlertCenterBundle, region: string): GlobalAlert[] {
  return getAlertsForRegion(bundle.alerts, region);
}

export function getAlertHistory(window: HistoryWindow): GlobalAlert[] {
  return alertHistoryStore.getWindow(window);
}

export function getCrisisBriefing(bundle: AlertCenterBundle, crisisId: string): CrisisBriefing | null {
  const crisis = bundle.crises.find((c) => c.id === crisisId);
  if (!crisis) return null;
  return generateCrisisBriefing(crisis, bundle.alerts, bundle.events);
}

export function getAllCrisisBriefings(bundle: AlertCenterBundle): CrisisBriefing[] {
  return generateAllCrisisBriefings(bundle.crises, bundle.alerts, bundle.events);
}

export function getAlertById(bundle: AlertCenterBundle, alertId: string): GlobalAlert | null {
  return bundle.alerts.find((a) => a.id === alertId) ?? null;
}

/** Events referenced by an alert — used by the Alert Detail view and Knowledge Graph linking. */
export function getEventsForAlert(bundle: AlertCenterBundle, alert: GlobalAlert): GlobalEvent[] {
  const ids = new Set(alert.supportingEventIds);
  return bundle.events.filter((e) => ids.has(e.id));
}
