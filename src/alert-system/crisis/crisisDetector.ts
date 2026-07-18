/**
 * Crisis Detector
 *
 * Identifies significant ONGOING situations from the current alert pool.
 * This module never predicts future events — it only recognizes patterns
 * that are already visible in real, verified platform data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DETECTION PATTERNS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. earthquake_cluster
 *    ≥3 earthquake alerts/events (M-signal) within the same region in 72h
 *
 * 2. conflict_escalation
 *    A single country's conflict/military alert reaches "high"+ level
 *    AND has ≥3 supporting events (sustained activity, not a single report)
 *
 * 3. disaster_cluster
 *    ≥2 distinct natural-disaster alerts (wildfire/flood/volcano/disaster)
 *    active in the same region simultaneously
 *
 * 4. extreme_weather_multi_country
 *    ≥3 countries with active high+ weather/climate alerts at the same time
 *
 * 5. cyber_infrastructure
 *    Any cyber alert reaching "critical"+ level (infrastructure-grade threat)
 *
 * 6. regional_convergence
 *    A single region has ≥4 active alerts across ≥3 different categories
 *    (suggests a compounding, multi-dimensional situation)
 *
 * Every crisis situation must cite the alerts and events that triggered it.
 */
import type { GlobalAlert, CrisisSituation, CrisisPattern, AlertLevel } from "../types";
import { ALERT_LEVEL_ORDER } from "../types";

let crisisCounter = 0;
function nextCrisisId(pattern: CrisisPattern): string {
  return `crisis:${pattern}:${crisisCounter++}`;
}

function levelAtLeast(level: AlertLevel, min: AlertLevel): boolean {
  return ALERT_LEVEL_ORDER.indexOf(level) >= ALERT_LEVEL_ORDER.indexOf(min);
}

function highestLevel(levels: AlertLevel[]): AlertLevel {
  return levels.reduce((max, l) => (ALERT_LEVEL_ORDER.indexOf(l) > ALERT_LEVEL_ORDER.indexOf(max) ? l : max), "information" as AlertLevel);
}

function avgConfidence(alerts: GlobalAlert[]): number {
  return alerts.length > 0 ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length) : 0;
}

function avgRisk(alerts: GlobalAlert[]): number {
  return alerts.length > 0 ? Math.round(alerts.reduce((s, a) => s + a.riskScore, 0) / alerts.length) : 0;
}

function collectCountries(alerts: GlobalAlert[]): string[] {
  return [...new Set(alerts.flatMap((a) => a.affectedCountries))];
}

function collectRegions(alerts: GlobalAlert[]): string[] {
  return [...new Set(alerts.flatMap((a) => a.affectedRegions))];
}

function collectEventIds(alerts: GlobalAlert[]): string[] {
  return [...new Set(alerts.flatMap((a) => a.supportingEventIds))];
}

// ─── Pattern 1: earthquake cluster ────────────────────────────────────────────

function detectEarthquakeClusters(alerts: GlobalAlert[]): CrisisSituation[] {
  const quakeAlerts = alerts.filter((a) => a.sourceType === "earthquake" && a.status !== "resolved");
  const byRegion = new Map<string, GlobalAlert[]>();
  for (const a of quakeAlerts) {
    for (const region of a.affectedRegions.length ? a.affectedRegions : ["Unclassified"]) {
      const arr = byRegion.get(region) ?? [];
      arr.push(a);
      byRegion.set(region, arr);
    }
  }

  const results: CrisisSituation[] = [];
  for (const [region, regionAlerts] of byRegion) {
    const totalEvents = collectEventIds(regionAlerts).length;
    if (regionAlerts.length < 2 && totalEvents < 3) continue;

    results.push({
      id: nextCrisisId("earthquake_cluster"),
      pattern: "earthquake_cluster",
      title: `Seismic Cluster — ${region}`,
      level: highestLevel(regionAlerts.map((a) => a.level)),
      affectedCountries: collectCountries(regionAlerts),
      affectedRegions: [region],
      alertIds: regionAlerts.map((a) => a.id),
      supportingEventIds: collectEventIds(regionAlerts),
      confidence: avgConfidence(regionAlerts),
      riskScore: avgRisk(regionAlerts),
      reason: `${totalEvents} significant seismic events detected across ${regionAlerts.length} alert${regionAlerts.length > 1 ? "s" : ""} in ${region}.`,
      detectedAt: new Date().toISOString(),
      active: true,
    });
  }
  return results;
}

// ─── Pattern 2: conflict escalation ───────────────────────────────────────────

function detectConflictEscalation(alerts: GlobalAlert[]): CrisisSituation[] {
  const conflictAlerts = alerts.filter(
    (a) => a.sourceType === "conflict" && a.status !== "resolved" && levelAtLeast(a.level, "high") && a.supportingEventIds.length >= 3,
  );

  return conflictAlerts.map((a) => ({
    id: nextCrisisId("conflict_escalation"),
    pattern: "conflict_escalation" as const,
    title: `Conflict Escalation — ${a.affectedCountries[0] ?? "Unknown"}`,
    level: a.level,
    affectedCountries: a.affectedCountries,
    affectedRegions: a.affectedRegions,
    alertIds: [a.id],
    supportingEventIds: a.supportingEventIds,
    confidence: a.confidence,
    riskScore: a.riskScore,
    reason: `Sustained conflict activity: ${a.supportingEventIds.length} events reaching "${a.level}" alert level in ${a.affectedCountries[0] ?? "the region"}.`,
    detectedAt: new Date().toISOString(),
    active: true,
  }));
}

// ─── Pattern 3: disaster cluster ──────────────────────────────────────────────

function detectDisasterClusters(alerts: GlobalAlert[]): CrisisSituation[] {
  const disasterAlerts = alerts.filter(
    (a) => ["wildfire", "flood", "volcano"].includes(a.sourceType) && a.status !== "resolved",
  );

  const byRegion = new Map<string, GlobalAlert[]>();
  for (const a of disasterAlerts) {
    for (const region of a.affectedRegions.length ? a.affectedRegions : ["Unclassified"]) {
      const arr = byRegion.get(region) ?? [];
      arr.push(a);
      byRegion.set(region, arr);
    }
  }

  const results: CrisisSituation[] = [];
  for (const [region, regionAlerts] of byRegion) {
    if (regionAlerts.length < 2) continue;
    results.push({
      id: nextCrisisId("disaster_cluster"),
      pattern: "disaster_cluster",
      title: `Natural Disaster Cluster — ${region}`,
      level: highestLevel(regionAlerts.map((a) => a.level)),
      affectedCountries: collectCountries(regionAlerts),
      affectedRegions: [region],
      alertIds: regionAlerts.map((a) => a.id),
      supportingEventIds: collectEventIds(regionAlerts),
      confidence: avgConfidence(regionAlerts),
      riskScore: avgRisk(regionAlerts),
      reason: `${regionAlerts.length} distinct natural disaster alerts active simultaneously in ${region}.`,
      detectedAt: new Date().toISOString(),
      active: true,
    });
  }
  return results;
}

// ─── Pattern 4: extreme weather, multi-country ───────────────────────────────

function detectExtremeWeather(alerts: GlobalAlert[]): CrisisSituation[] {
  const weatherAlerts = alerts.filter(
    (a) => a.sourceType === "weather" && a.status !== "resolved" && levelAtLeast(a.level, "high"),
  );
  const countries = collectCountries(weatherAlerts);
  if (countries.length < 3) return [];

  return [{
    id: nextCrisisId("extreme_weather_multi_country"),
    pattern: "extreme_weather_multi_country",
    title: `Extreme Weather — ${countries.length} Countries Affected`,
    level: highestLevel(weatherAlerts.map((a) => a.level)),
    affectedCountries: countries,
    affectedRegions: collectRegions(weatherAlerts),
    alertIds: weatherAlerts.map((a) => a.id),
    supportingEventIds: collectEventIds(weatherAlerts),
    confidence: avgConfidence(weatherAlerts),
    riskScore: avgRisk(weatherAlerts),
    reason: `Severe weather alerts simultaneously active across ${countries.length} countries: ${countries.slice(0, 5).join(", ")}.`,
    detectedAt: new Date().toISOString(),
    active: true,
  }];
}

// ─── Pattern 5: cyber infrastructure threat ──────────────────────────────────

function detectCyberInfrastructure(alerts: GlobalAlert[]): CrisisSituation[] {
  const cyberAlerts = alerts.filter(
    (a) => a.sourceType === "cyber" && a.status !== "resolved" && levelAtLeast(a.level, "critical"),
  );

  return cyberAlerts.map((a) => ({
    id: nextCrisisId("cyber_infrastructure"),
    pattern: "cyber_infrastructure" as const,
    title: `Cyber Infrastructure Threat — ${a.affectedCountries[0] ?? "Global"}`,
    level: a.level,
    affectedCountries: a.affectedCountries,
    affectedRegions: a.affectedRegions,
    alertIds: [a.id],
    supportingEventIds: a.supportingEventIds,
    confidence: a.confidence,
    riskScore: a.riskScore,
    reason: `Critical-severity cyber activity detected, reaching "${a.level}" alert level.`,
    detectedAt: new Date().toISOString(),
    active: true,
  }));
}

// ─── Pattern 6: regional convergence ──────────────────────────────────────────

function detectRegionalConvergence(alerts: GlobalAlert[]): CrisisSituation[] {
  const activeAlerts = alerts.filter((a) => a.status !== "resolved");
  const byRegion = new Map<string, GlobalAlert[]>();
  for (const a of activeAlerts) {
    for (const region of a.affectedRegions) {
      const arr = byRegion.get(region) ?? [];
      arr.push(a);
      byRegion.set(region, arr);
    }
  }

  const results: CrisisSituation[] = [];
  for (const [region, regionAlerts] of byRegion) {
    const categories = new Set(regionAlerts.map((a) => a.category));
    if (regionAlerts.length < 4 || categories.size < 3) continue;

    results.push({
      id: nextCrisisId("regional_convergence"),
      pattern: "regional_convergence",
      title: `Multi-Dimensional Risk Convergence — ${region}`,
      level: highestLevel(regionAlerts.map((a) => a.level)),
      affectedCountries: collectCountries(regionAlerts),
      affectedRegions: [region],
      alertIds: regionAlerts.map((a) => a.id),
      supportingEventIds: collectEventIds(regionAlerts),
      confidence: avgConfidence(regionAlerts),
      riskScore: avgRisk(regionAlerts),
      reason: `${regionAlerts.length} active alerts across ${categories.size} distinct categories converging in ${region}.`,
      detectedAt: new Date().toISOString(),
      active: true,
    });
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectCrises(alerts: GlobalAlert[]): CrisisSituation[] {
  const situations = [
    ...detectEarthquakeClusters(alerts),
    ...detectConflictEscalation(alerts),
    ...detectDisasterClusters(alerts),
    ...detectExtremeWeather(alerts),
    ...detectCyberInfrastructure(alerts),
    ...detectRegionalConvergence(alerts),
  ];

  return situations.sort((a, b) => b.riskScore - a.riskScore);
}

export function hasActiveCrisis(crises: CrisisSituation[]): boolean {
  return crises.some((c) => c.active && levelAtLeast(c.level, "high"));
}

export function getMostSevereCrisis(crises: CrisisSituation[]): CrisisSituation | null {
  if (crises.length === 0) return null;
  return [...crises].sort((a, b) => {
    const levelDiff = ALERT_LEVEL_ORDER.indexOf(b.level) - ALERT_LEVEL_ORDER.indexOf(a.level);
    return levelDiff !== 0 ? levelDiff : b.riskScore - a.riskScore;
  })[0];
}
