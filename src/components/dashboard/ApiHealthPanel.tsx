import { useCallback, useEffect, useState } from "react";
import { Activity, Heart, RefreshCw } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllCountries } from "@/services/countriesApi";
import { getEarthquakes } from "@/services/earthquakesApi";
import { fetchIntelligence, type NewsStatus } from "@/services/newsApi";
import { hasWeatherKey } from "@/services/weatherApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";

type Health =
  | "online" | "cached" | "cached_live" | "demo" | "rate_limited" | "error"
  | "not_configured" | "invalid_key" | "fallback" | "checking";

interface ApiRow {
  name: string;
  status: Health;
  lastOk?: number;
  detail?: string;
}

const VARIANT: Record<Health, "live" | "neutral" | "demo" | "error" | "source"> = {
  online: "live",
  cached: "neutral",
  cached_live: "live",
  demo: "demo",
  rate_limited: "error",
  error: "error",
  not_configured: "neutral",
  invalid_key: "error",
  fallback: "source",
  checking: "neutral",
};
const LABEL: Record<Health, string> = {
  online: "Online",
  cached: "Cached",
  cached_live: "Cached live data",
  demo: "Demo",
  rate_limited: "Rate limited",
  error: "Error",
  not_configured: "Not configured",
  invalid_key: "Invalid key",
  fallback: "Fallback",
  checking: "Checking…",
};

export function ApiHealthPanel() {
  const [rows, setRows] = useState<ApiRow[]>([
    { name: "REST Countries", status: "checking" },
    { name: "USGS Earthquake", status: "checking" },
    { name: "GNews Proxy", status: "checking" },
    { name: "OpenWeather", status: "checking" },
    { name: "Supabase", status: "checking" },
    { name: "Mapbox", status: "checking" },
  ]);
  const [refreshing, setRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    const next: ApiRow[] = [];

    try {
      const c = await getAllCountries();
      next.push({ name: "REST Countries", status: c.length > 0 ? "online" : "error", lastOk: Date.now(), detail: `${c.length} countries` });
    } catch (e: any) {
      next.push({ name: "REST Countries", status: "error", detail: e?.message });
    }

    try {
      const q = await getEarthquakes("day");
      next.push({ name: "USGS Earthquake", status: "online", lastOk: Date.now(), detail: `${q.length} events` });
    } catch (e: any) {
      next.push({ name: "USGS Earthquake", status: "error", detail: e?.message });
    }

    try {
      const r = await fetchIntelligence({ max: 10 });
      const map: Record<NewsStatus, Health> = {
        live: "online", cached: "cached", demo: "demo", rate_limited: "rate_limited", error: "error",
      };
      next.push({
        name: "GNews Proxy",
        status: map[r.status],
        lastOk: r.cachedAt,
        detail: r.message ?? `${r.items.length} items via /api/public/gnews-proxy`,
      });
    } catch (e: any) {
      next.push({ name: "GNews Proxy", status: "error", detail: e?.message });
    }

    if (!hasWeatherKey()) {
      next.push({ name: "OpenWeather", status: "not_configured", detail: "Set VITE_OPENWEATHER_API_KEY" });
    } else {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=London&appid=${apiKey}`);
        if (res.status === 429) next.push({ name: "OpenWeather", status: "rate_limited" });
        else if (!res.ok) next.push({ name: "OpenWeather", status: "error", detail: `HTTP ${res.status}` });
        else next.push({ name: "OpenWeather", status: "online", lastOk: Date.now() });
      } catch (e: any) {
        next.push({ name: "OpenWeather", status: "error", detail: e?.message });
      }
    }

    if (!isSupabaseConfigured()) {
      next.push({ name: "Supabase", status: "not_configured" });
    } else {
      try {
        await supabaseService.listSavedCountries();
        next.push({ name: "Supabase", status: "online", lastOk: Date.now() });
      } catch (e: any) {
        next.push({ name: "Supabase", status: "error", detail: e?.message });
      }
    }

    const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
    next.push({
      name: "Mapbox",
      status: hasMapbox ? "online" : "demo",
      lastOk: hasMapbox ? Date.now() : undefined,
      detail: hasMapbox ? "Token configured" : "Using fallback shared token",
    });

    setRows(next);
    setRefreshing(false);
  }, []);

  useEffect(() => { runChecks(); }, [runChecks]);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title="API Health"
        subtitle="Live status of all integrated data sources"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => runChecks()}
              disabled={refreshing}
              title="Re-check all data sources"
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Heart className="h-4 w-4 text-rose-glow" />
          </div>
        }
      />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs font-medium">{r.name}</div>
                {r.detail && <div className="truncate text-[10px] text-muted-foreground">{r.detail}</div>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {r.lastOk ? new Date(r.lastOk).toLocaleTimeString() : "—"}
              </span>
              <DataBadge variant={VARIANT[r.status]}>{LABEL[r.status]}</DataBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
