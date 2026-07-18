import type { WeatherData } from "@/types";
import { fallbackWeather } from "@/data/fallbackWeather";

/**
 * Weather data via the server-side `/api/public/openweather-proxy` — the API
 * key never enters the client bundle (previously it was read from
 * `VITE_OPENWEATHER_API_KEY` and used in a direct browser→openweathermap.org
 * fetch, which shipped the key to every visitor; fixed in a security audit).
 */
const PROXY_URL = "/api/public/openweather-proxy";

let configuredCache: { value: boolean; checkedAt: number } | null = null;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

interface ProxyResponse {
  ok: boolean;
  data?: {
    name?: string;
    sys?: { country?: string };
    main?: { temp?: number; feels_like?: number; humidity?: number };
    wind?: { speed?: number };
    weather?: { description?: string; icon?: string }[];
  };
  error?: string;
  message?: string;
  configured?: boolean;
}

/**
 * Whether live weather is configured server-side. Cached briefly so status
 * badges (Weather page, API Health panel) don't re-probe on every render.
 */
export async function isWeatherConfigured(force = false): Promise<boolean> {
  if (!force && configuredCache && Date.now() - configuredCache.checkedAt < CONFIG_CACHE_TTL_MS) {
    return configuredCache.value;
  }
  try {
    const res = await fetch(`${PROXY_URL}?city=probe&probe=1`);
    const data = (await res.json()) as ProxyResponse;
    const value = res.ok && data.ok === true;
    configuredCache = { value, checkedAt: Date.now() };
    return value;
  } catch {
    configuredCache = { value: false, checkedAt: Date.now() };
    return false;
  }
}

export async function getWeather(city: string): Promise<WeatherData> {
  const res = await fetch(`${PROXY_URL}?city=${encodeURIComponent(city)}`);
  const body = (await res.json()) as ProxyResponse;

  // No API key configured server-side — fall back to demo data (not an error).
  if (body.error === "not_configured") {
    return { ...fallbackWeather(city), isDemo: true };
  }
  // Real failures (city not found, invalid key, rate limit, network) still
  // throw so the caller's existing error UI/handling is preserved.
  if (!res.ok || !body.ok || !body.data) {
    throw new Error(body.message ?? `Weather lookup failed (${res.status})`);
  }

  const d = body.data;
  return {
    city: d.name ?? city,
    country: d.sys?.country ?? "",
    temperature: d.main?.temp ?? 0,
    feelsLike: d.main?.feels_like ?? 0,
    humidity: d.main?.humidity ?? 0,
    windSpeed: d.wind?.speed ?? 0,
    description: d.weather?.[0]?.description ?? "",
    icon: d.weather?.[0]?.icon ?? "01d",
  };
}
