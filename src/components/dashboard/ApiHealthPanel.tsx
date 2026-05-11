import { useEffect, useState } from "react";
import { Activity, Heart } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllCountries } from "@/services/countriesApi";
import { getEarthquakes } from "@/services/earthquakesApi";
import { fetchIntelligence, type NewsStatus } from "@/services/newsApi";
import { hasWeatherKey } from "@/services/weatherApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";

type Health = "online" | "cached" | "demo" | "rate_limited" | "error" | "not_configured" | "checking";

interface ApiRow {
  name: string;
  status: Health;
  lastOk?: number;
  detail?: string;
}

const VARIANT: Record<Health, "live" | "neutral" | "demo" | "error"> = {
  online: "live",
  cached: "neutral",
  demo: "demo",
  rate_limited: "error",
  error: "error",
  not_configured: "neutral",
  checking: "neutral",
};
const LABEL: Record<Health, string> = {
  online: "Online",
  cached: "Cached",
  demo: "Demo",
  rate_limited: "Rate limited",
  error: "Error",
  not_configured: "Not configured",
  checking: "Checking…",
};

export function ApiHealthPanel() {
  const [rows, setRows] = useState<ApiRow[]>([
    { name: "REST Countries", status: "checking" },
    { name: "USGS Earthquake", status: "checking" },
    { name: "GNews", status: "checking" },
    { name: "OpenWeather", status: "checking" },
    { name: "Supabase", status: "checking" },
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const next: ApiRow[] = [];

      // REST Countries
      try {
        const c = await getAllCountries();
        next.push({ name: "REST Countries", status: c.length > 0 ? "online" : "error", lastOk: Date.now(), detail: `${c.length} countries` });
      } catch (e: any) {
        next.push({ name: "REST Countries", status: "error", detail: e?.message });
      }

      // USGS Earthquake
      try {
        const q = await getEarthquakes("day");
        next.push({ name: "USGS Earthquake", status: "online", lastOk: Date.now(), detail: `${q.length} events` });
      } catch (e: any) {
        next.push({ name: "USGS Earthquake", status: "error", detail: e?.message });
      }

      // GNews — uses cached newsApi (no extra request)
      try {
        const r = await fetchIntelligence({ max: 10 });
        const map: Record<NewsStatus, Health> = {
          live: "online",
          cached: "cached",
          demo: "demo",
          rate_limited: "rate_limited",
          error: "error",
        };
        next.push({
          name: "GNews",
          status: map[r.status],
          lastOk: r.cachedAt,
          detail: r.message,
        });
      } catch (e: any) {
        next.push({ name: "GNews", status: "error", detail: e?.message });
      }

      // OpenWeather — only check if key present (avoid wasting quota: shallow ping)
      if (!hasWeatherKey()) {
        next.push({ name: "OpenWeather", status: "not_configured", detail: "Set VITE_OPENWEATHER_API_KEY" });
      } else {
        try {
          // Public ping endpoint with the key — minimal payload
          const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string;
          const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=London&appid=${apiKey}`);
          if (res.status === 429) next.push({ name: "OpenWeather", status: "rate_limited" });
          else if (!res.ok) next.push({ name: "OpenWeather", status: "error", detail: `HTTP ${res.status}` });
          else next.push({ name: "OpenWeather", status: "online", lastOk: Date.now() });
        } catch (e: any) {
          next.push({ name: "OpenWeather", status: "error", detail: e?.message });
        }
      }

      // Supabase
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

      if (alive) setRows(next);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title="API Health"
        subtitle="Live status of all integrated data sources"
        right={<Heart className="h-4 w-4 text-rose-glow" />}
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
