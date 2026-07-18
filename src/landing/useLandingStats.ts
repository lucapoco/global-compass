/**
 * Live platform statistics for the Landing Page.
 * Uses the shared Intelligence Store cache — no duplicate provider calls.
 */
import { useEffect, useState } from "react";
import { getLatestEvents } from "@/domain/store";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

export interface LandingStats {
  countriesMonitored: number;
  activeEvents: number;
  criticalEvents: number;
  earthquakes: number;
  weatherAlerts: number;
  intelligenceReports: number;
  loading: boolean;
  events: GlobalEvent[];
}

function countUniqueCountries(events: GlobalEvent[]): number {
  const set = new Set<string>();
  for (const e of events) {
    if (e.country) set.add(e.country);
    for (const c of e.countries ?? []) {
      if (c) set.add(c);
    }
  }
  return set.size;
}

export function useLandingStats(): LandingStats {
  const [stats, setStats] = useState<LandingStats>({
    countriesMonitored: 0,
    activeEvents: 0,
    criticalEvents: 0,
    earthquakes: 0,
    weatherAlerts: 0,
    intelligenceReports: 0,
    loading: true,
    events: [],
  });

  useEffect(() => {
    let cancelled = false;

    void getLatestEvents({ limit: 400 })
      .then((events) => {
        if (cancelled) return;
        const countries = countUniqueCountries(events);
        setStats({
          countriesMonitored: countries > 0 ? countries : 195,
          activeEvents: events.length,
          criticalEvents: events.filter((e) => e.severity === "critical" || e.severity === "high").length,
          earthquakes: events.filter((e) => e.category === "earthquake").length,
          weatherAlerts: events.filter((e) => e.category === "weather" || e.category === "disaster").length,
          intelligenceReports: events.filter((e) =>
            ["geopolitics", "military", "cyber", "economy"].includes(e.category),
          ).length,
          loading: false,
          events,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStats((s) => ({ ...s, countriesMonitored: 195, loading: false }));
        }
      });

    return () => { cancelled = true; };
  }, []);

  return stats;
}
