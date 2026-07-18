import type { WeatherData } from "@/types";

/** Date meteo illustrative când OpenWeather nu este configurat. */
export function fallbackWeather(city: string): WeatherData {
  return {
    city: city || "Bucharest",
    country: "RO",
    temperature: 21,
    feelsLike: 20,
    humidity: 58,
    windSpeed: 3.4,
    description: "partly cloudy",
    icon: "02d",
    isDemo: true,
  };
}
