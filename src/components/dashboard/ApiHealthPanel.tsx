import { useCallback, useEffect, useState } from "react";
import { Activity, Heart, RefreshCw } from "lucide-react";
import { useT } from "@/i18n";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllCountries, getCountriesStatus, type CountriesStatus } from "@/services/countriesApi";
import { getEarthquakes } from "@/services/earthquakesApi";
import { fetchIntelligence, type NewsStatus } from "@/services/newsApi";
import { isWeatherConfigured } from "@/services/weatherApi";
import { getSupabaseViteEnvSummary } from "@/lib/supabaseEnv";
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

function healthLabel(status: Health, t: (key: string) => string): string {
  if (status === "online") return t("app.pages.dashboard.statusBar.aiOnline");
  if (status === "demo") return t("app.ui.dataStatus.demo");
  if (status === "cached") return t("app.ui.dataStatus.cached");
  if (status === "cached_live") return t("app.ui.dataStatus.cached");
  if (status === "checking") return t("app.ui.loading");
  return LABEL[status];
}

export function ApiHealthPanel() {
  const t = useT();
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
      const cs: CountriesStatus = getCountriesStatus();
      const statusMap: Record<CountriesStatus, Health> = {
        live: "online", cached: "cached", local: "fallback", error: "error", idle: "checking",
      };
      const detail =
        cs === "live" ? `${c.length} countries via /api/public/restcountries-proxy (live)` :
        cs === "cached" ? `${c.length} countries (server cache)` :
        cs === "local" ? `${c.length} bundled countries — proxy unreachable` :
        "All fallbacks failed";
      next.push({ name: "REST Countries", status: statusMap[cs] ?? "error", lastOk: cs !== "error" ? Date.now() : undefined, detail });
    } catch (e: unknown) {
      next.push({ name: "REST Countries", status: "error", detail: e instanceof Error ? e.message : undefined });
    }

    try {
      const q = await getEarthquakes("day");
      next.push({ name: "USGS Earthquake", status: "online", lastOk: Date.now(), detail: `${q.length} events` });
    } catch (e: unknown) {
      next.push({ name: "USGS Earthquake", status: "error", detail: e instanceof Error ? e.message : undefined });
    }

    try {
      const r = await fetchIntelligence({ max: 10, probe: true });
      const map: Record<NewsStatus, Health> = {
        live: "online", cached: "cached_live", demo: "demo", rate_limited: "rate_limited", error: "error",
      };
      next.push({
        name: "GNews Proxy",
        status: map[r.status],
        lastOk: r.cachedAt,
        detail: r.status === "cached"
          ? `Serving cached live data · ${r.items.length} items`
          : r.message ?? `${r.items.length} items via /api/public/gnews-proxy`,
      });
    } catch (e: unknown) {
      next.push({ name: "GNews Proxy", status: "error", detail: e instanceof Error ? e.message : undefined });
    }

    try {
      // Probes the server-side proxy only — the API key never reaches the browser.
      const configured = await isWeatherConfigured(true);
      if (!configured) {
        next.push({ name: "OpenWeather", status: "not_configured", detail: "Add OPENWEATHER_API_KEY (server env) to enable live weather. Demo fallback in use." });
      } else {
        next.push({ name: "OpenWeather", status: "online", lastOk: Date.now(), detail: "Key configured via /api/public/openweather-proxy" });
      }
    } catch (e: unknown) {
      next.push({ name: "OpenWeather", status: "error", detail: e instanceof Error ? e.message : undefined });
    }

    if (!isSupabaseConfigured()) {
      next.push({
        name: "Supabase",
        status: "not_configured",
        detail: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart `npm run dev`.",
      });
    } else {
      try {
        const meta = getSupabaseViteEnvSummary();
        const probe = await supabaseService.testSavedDataConnection();
        const rowSummary = probe.rows
          .map((r) => (r.error ? `${r.table}: ${r.error}` : `${r.table}=${r.count}`))
          .join(" · ");
        next.push({
          name: "Supabase",
          status: probe.ok ? "online" : "error",
          lastOk: Date.now(),
          detail: probe.ok
            ? `ONLINE · ref ${meta.projectRef ?? "?"} · ${rowSummary}`
            : `ref ${meta.projectRef ?? "?"} — ${probe.message}`,
        });
      } catch (e: unknown) {
        next.push({ name: "Supabase", status: "error", detail: e instanceof Error ? e.message : undefined });
      }
    }

    const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
    next.push({
      name: "Mapbox",
      status: hasMapbox ? "online" : "not_configured",
      lastOk: hasMapbox ? Date.now() : undefined,
      detail: hasMapbox
        ? "Token configured — Mapbox GL globe active"
        : "Add VITE_MAPBOX_TOKEN to render the map. Clustering and custom styles require your own token.",
    });

    setRows(next);
    setRefreshing(false);
  }, []);

  useEffect(() => { runChecks(); }, [runChecks]);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title={t("app.pages.dashboard.apiHealth.title")}
        subtitle={t("app.pages.dashboard.apiHealth.subtitle")}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => runChecks()}
              disabled={refreshing}
              title={t("app.ui.refresh")}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> {t("app.ui.refresh")}
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
              <span suppressHydrationWarning className="text-[10px] tabular-nums text-muted-foreground">
                {r.lastOk ? new Date(r.lastOk).toLocaleTimeString() : "—"}
              </span>
              <DataBadge variant={VARIANT[r.status]}>{healthLabel(r.status, t)}</DataBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
