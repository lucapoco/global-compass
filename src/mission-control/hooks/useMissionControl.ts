/**
 * useMissionControl — Primary data hook for Mission Control.
 *
 * Loads all intelligence data from the platform's services and exposes
 * a unified state object consumed by all Mission Control widgets.
 *
 * Data sources:
 *   • EventEngine  — all GlobalEvents
 *   • Decision Engine (DSE) — Global Stability Index + executive summary
 *
 * Refresh schedule:
 *   • Full reload every 5 minutes (normal interval)
 *   • Immediate reload on manual trigger
 *   • Pauses automatically when tab is hidden
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { getLatestEvents } from "@/domain/store";
import { filterIntelligenceSignals } from "@/domain/constants/metadataProviders";
import { computeGlobalStabilityIndex } from "@/domain/decision/stability/stabilityEngine";
import { buildExecutiveSummary } from "@/domain/decision/summary/summaryEngine";
import type { MissionControlState, ProviderStatus } from "../types";
import { REFRESH_INTERVALS } from "../types";

// ─── Provider label map ───────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  gnews:                 "GNews Intelligence",
  usgs:                  "USGS Earthquakes",
  openweather:           "OpenWeather",
  rest_countries:        "REST Countries",
  nasa_eonet:            "NASA EONET",
  acled:                 "ACLED Conflict",
  world_bank:            "World Bank",
  supabase_alerts:       "Saved Alerts",
  supabase_intelligence: "Saved Intel",
  internal:              "Internal",
};

// ─── Build provider status ────────────────────────────────────────────────────

function buildProviderStatus(events: import("@/domain/models/GlobalEvent").GlobalEvent[]): ProviderStatus[] {
  const byProvider = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byProvider.get(e.provider) ?? [];
    arr.push(e);
    byProvider.set(e.provider, arr);
  }

  return [...byProvider.entries()].map(([id, pevents]) => {
    const latestEvent = pevents.reduce(
      (latest, e) => (new Date(e.timestamp) > new Date(latest.timestamp) ? e : latest),
      pevents[0],
    );
    const ageMs = Date.now() - new Date(latestEvent.timestamp).getTime();
    const status: ProviderStatus["status"] =
      latestEvent.status === "live" ? "online" :
      latestEvent.status === "error" ? "offline" :
      latestEvent.status === "demo" ? "degraded" : "unknown";

    return {
      id,
      label: PROVIDER_LABELS[id] ?? id,
      status,
      lastEventAt: latestEvent.timestamp,
      eventCount: pevents.length,
    };
  }).sort((a, b) => b.eventCount - a.eventCount);
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: MissionControlState = {
  events: [],
  criticalEvents: [],
  recentEvents: [],
  gsi: null,
  summary: null,
  providerStatus: [],
  lastRefreshed: null,
  nextRefreshIn: REFRESH_INTERVALS.normal / 1000,
  loadState: "idle",
  error: null,
  totalProcessed: 0,
  countriesCovered: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMissionControl() {
  const [state, setState] = useState<MissionControlState>(INITIAL_STATE);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRefreshRef = useRef(REFRESH_INTERVALS.normal / 1000);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loadState: "loading", error: null }));
    try {
      const allEvents = await getLatestEvents();
      const events = filterIntelligenceSignals(allEvents);
      const gsi = computeGlobalStabilityIndex(events);
      const summary = buildExecutiveSummary(events, gsi);

      const now = Date.now();
      const recent24h = events.filter(
        (e) => now - new Date(e.timestamp).getTime() <= 86_400_000,
      );
      const critical = events.filter((e) => e.severity === "critical")
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 20);

      const countries = new Set(events.map((e) => e.country).filter(Boolean));

      setState({
        events,
        criticalEvents: critical,
        recentEvents: recent24h,
        gsi,
        summary,
        providerStatus: buildProviderStatus(events),
        lastRefreshed: new Date(),
        nextRefreshIn: REFRESH_INTERVALS.normal / 1000,
        loadState: "loaded",
        error: null,
        totalProcessed: events.length,
        countriesCovered: countries.size,
      });

      nextRefreshRef.current = REFRESH_INTERVALS.normal / 1000;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loadState: "error",
        error: err instanceof Error ? err.message : "Load failed",
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh (5 min)
  useEffect(() => {
    timerRef.current = setInterval(() => void load(), REFRESH_INTERVALS.normal);
    countdownRef.current = setInterval(() => {
      nextRefreshRef.current = Math.max(0, nextRefreshRef.current - 1);
      setState((prev) => ({ ...prev, nextRefreshIn: nextRefreshRef.current }));
    }, 1000);

    function onVisible() {
      if (!document.hidden) void load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { state, refresh: load };
}
