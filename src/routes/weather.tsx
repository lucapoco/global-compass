import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Droplets, Wind, Thermometer, Gauge } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataBadge } from "@/components/ui/DataBadge";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getWeather, hasWeatherKey } from "@/services/weatherApi";
import type { WeatherData } from "@/types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/weather")({
  head: () => ({ meta: [{ title: "Weather — Global Pulse" }] }),
  component: WeatherPage,
});

function WeatherPage() {
  const [city, setCity] = useState("Bucharest");
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null); setData(null);
    try { setData(await getWeather(city)); }
    catch (e: any) { setError(e.message ?? "Failed."); }
    finally { setLoading(false); }
  }

  const forecast = data ? Array.from({ length: 8 }, (_, i) => ({
    h: `+${i * 3}h`,
    t: Math.round(data.temperature + Math.sin(i) * 2 - i * 0.2),
  })) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weather</h1>
          <p className="text-xs text-muted-foreground">{hasWeatherKey() ? "Live current conditions via OpenWeather" : "Demo data — add VITE_OPENWEATHER_API_KEY for live"}</p>
        </div>
        <div className="flex gap-2">
          {hasWeatherKey() ? <DataBadge variant="live">Live</DataBadge> : <DataBadge variant="demo">Demo</DataBadge>}
          <DataBadge variant="source">OpenWeather</DataBadge>
        </div>
      </div>

      <div className="glass-card p-4">
        <SearchInput value={city} onChange={setCity} onSubmit={run} placeholder="Search city (e.g. Cluj-Napoca)" />
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-card p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{data.country}</div>
                <div className="text-2xl font-semibold">{data.city}</div>
              </div>
              {data.isDemo && <DataBadge variant="demo">Demo</DataBadge>}
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-semibold tabular-nums">{Math.round(data.temperature)}°</span>
              <span className="pb-2 text-xs text-muted-foreground capitalize">{data.description}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Stat icon={<Thermometer className="h-3.5 w-3.5" />} k="Feels like" v={`${Math.round(data.feelsLike)}°`} />
              <Stat icon={<Droplets className="h-3.5 w-3.5" />} k="Humidity" v={`${data.humidity}%`} />
              <Stat icon={<Wind className="h-3.5 w-3.5" />} k="Wind" v={`${data.windSpeed.toFixed(1)} m/s`} />
              <Stat icon={<Gauge className="h-3.5 w-3.5" />} k="Icon" v={data.icon} />
            </div>
          </div>

          <div className="glass-card p-5 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
              <span>24-hour outlook</span>
              <DataBadge variant="demo">Illustrative</DataBadge>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={forecast}>
                  <XAxis dataKey="h" stroke="oklch(0.7 0.03 240)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.03 240)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.21 0.03 250)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="t" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-2.5 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">{icon} {k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
