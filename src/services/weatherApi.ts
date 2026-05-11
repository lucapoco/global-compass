import type { WeatherData } from "@/types";
import { demoWeather } from "@/data/demoWeather";

const API_KEY = (import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined)?.trim() ?? "";

export const hasWeatherKey = (): boolean => Boolean(API_KEY);

export async function getWeather(city: string): Promise<WeatherData> {
  if (!API_KEY) {
    return { ...demoWeather(city), isDemo: true };
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  const d = await res.json();
  return {
    city: d.name,
    country: d.sys?.country ?? "",
    temperature: d.main?.temp ?? 0,
    feelsLike: d.main?.feels_like ?? 0,
    humidity: d.main?.humidity ?? 0,
    windSpeed: d.wind?.speed ?? 0,
    description: d.weather?.[0]?.description ?? "",
    icon: d.weather?.[0]?.icon ?? "01d",
  };
}
