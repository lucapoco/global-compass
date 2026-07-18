/**
 * Alert Analytics
 *
 * Computes summary statistics over the current alert pool for the
 * Global Alert Center's statistics panel.
 */
import type { GlobalAlert, AlertAnalytics, AlertLevel, AlertSourceType } from "../types";
import { ALERT_LEVEL_ORDER } from "../types";

export function buildAlertAnalytics(alerts: GlobalAlert[]): AlertAnalytics {
  const byLevel = Object.fromEntries(
    ALERT_LEVEL_ORDER.map((level) => [level, alerts.filter((a) => a.level === level).length]),
  ) as Record<AlertLevel, number>;

  const bySourceType: Partial<Record<AlertSourceType, number>> = {};
  for (const a of alerts) {
    bySourceType[a.sourceType] = (bySourceType[a.sourceType] ?? 0) + 1;
  }

  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  for (const a of alerts) {
    for (const c of a.affectedCountries) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
    for (const r of a.affectedRegions) regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
  }

  const topCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  const topRegions = [...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([region, count]) => ({ region, count }));

  const avgConfidence = alerts.length > 0
    ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length)
    : 0;

  const multiSourceRate = alerts.length > 0
    ? Math.round((alerts.filter((a) => a.multiSourceConfirmed).length / alerts.length) * 100) / 100
    : 0;

  return {
    totalActive: alerts.filter((a) => a.status === "active" || a.status === "escalated").length,
    totalResolved: alerts.filter((a) => a.status === "resolved").length,
    totalCritical: byLevel.critical,
    totalExtreme: byLevel.extreme,
    byLevel,
    bySourceType,
    topCountries,
    topRegions,
    avgConfidence,
    multiSourceRate,
    calculatedAt: new Date().toISOString(),
  };
}
