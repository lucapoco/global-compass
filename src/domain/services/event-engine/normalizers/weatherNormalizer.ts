import type { WeatherData } from "@/types";
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";

/** OpenWeather (or demo fallback) single-city snapshot → GlobalEvent. */
export function normalizeWeather(weather: WeatherData): GlobalEvent {
  const status = weather.isDemo ? "demo" : "live";
  return createGlobalEvent({
    id: `weather-${weather.city}-${weather.country}`.toLowerCase().replace(/\s+/g, "-"),
    title: `${weather.city}: ${weather.description}`,
    description: `${weather.temperature.toFixed(1)}°C (feels like ${weather.feelsLike.toFixed(1)}°C), wind ${weather.windSpeed} m/s, humidity ${weather.humidity}%`,
    category: "weather",
    severity: "low", // overwritten by scoring engine using wind speed
    source: weather.isDemo ? "Demo" : "OpenWeather",
    provider: "openweather",
    country: weather.country || undefined,
    locationName: weather.city,
    timestamp: new Date().toISOString(),
    icon: weather.icon,
    tags: ["weather", weather.city.toLowerCase()],
    status,
    live: !weather.isDemo,
    verified: !weather.isDemo,
    metadata: {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      windSpeedMs: weather.windSpeed,
    },
  });
}
