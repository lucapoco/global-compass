import { useState } from "react";
import { CloudSun, Loader2, X } from "lucide-react";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { weatherProvider } from "@/domain/services/event-engine/providers";
import { useT } from "@/i18n";

interface Props {
  countryEvent: GlobalEvent;
  allEvents: GlobalEvent[];
  onClose: () => void;
  onSelectEvent: (e: GlobalEvent) => void;
}

/** Click-a-capital country insight panel: stats, recent events, risk, weather (on demand), saved status. */
export function MapCountryInsightPanel({ countryEvent, allEvents, onClose, onSelectEvent }: Props) {
  const t = useT();
  const [weather, setWeather] = useState<GlobalEvent | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const country = countryEvent.country ?? countryEvent.title;
  const recentEvents = allEvents
    .filter((e) => e.provider !== "rest_countries" && e.country?.toLowerCase() === country.toLowerCase())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
  const riskScore = recentEvents.length ? Math.max(...recentEvents.map((e) => e.riskScore)) : 0;
  const savedCount = recentEvents.filter((e) => e.provider === "supabase_alerts" || e.provider === "supabase_intelligence").length;
  const meta = countryEvent.metadata as { population?: number; area?: number; region?: string; subregion?: string };

  async function loadWeather() {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const city = countryEvent.locationName ?? country;
      setWeather(await weatherProvider.loadForCity(city));
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : "Weather lookup failed");
    } finally {
      setWeatherLoading(false);
    }
  }

  return (
    <div className="glass-card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{country}</h3>
          <p className="text-[11px] text-muted-foreground">{countryEvent.title}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border/50 p-1 text-muted-foreground hover:text-foreground" aria-label={t("app.pages.map.ui.closePanel")}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <div className="text-muted-foreground">{t("app.pages.map.ui.population")}</div>
          <div className="font-medium">{meta.population ? meta.population.toLocaleString() : "—"}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <div className="text-muted-foreground">{t("app.pages.map.ui.region")}</div>
          <div className="font-medium">{meta.region ?? "—"}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <div className="text-muted-foreground">{t("app.pages.map.ui.riskScoreRecent")}</div>
          <div className="font-medium">{recentEvents.length ? `${riskScore} / 100` : t("app.pages.map.ui.noRecentEvents")}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <div className="text-muted-foreground">{t("app.pages.map.ui.savedStatus")}</div>
          <div className="font-medium">{savedCount > 0 ? t("app.pages.map.ui.savedItems", { count: savedCount }) : t("app.pages.map.ui.noneSaved")}</div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => void loadWeather()}
          disabled={weatherLoading}
          className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {weatherLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudSun className="h-3.5 w-3.5" />}
          {weather ? t("app.pages.map.ui.refreshWeather") : t("app.pages.map.ui.loadWeather")}
        </button>
        {weather && <p className="mt-1.5 text-[11px] text-muted-foreground">{weather.description}</p>}
        {weatherError && <p className="mt-1.5 text-[11px] text-amber-600">{weatherError}</p>}
      </div>

      {recentEvents.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.recentEvents")}</div>
          <div className="space-y-1">
            {recentEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEvent(e)}
                className="block w-full rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5 text-left text-[11px] hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="line-clamp-1 font-medium text-foreground">{e.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.category} · {e.severity} · {t("app.pages.map.ui.riskWithScore", { score: e.riskScore })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
