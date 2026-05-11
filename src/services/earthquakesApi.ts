import type { Earthquake, Severity } from "@/types";

const FEEDS = {
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
};

export async function getEarthquakes(range: "day" | "week" = "day"): Promise<Earthquake[]> {
  const res = await fetch(FEEDS[range]);
  if (!res.ok) throw new Error(`USGS feed failed (${res.status})`);
  const data = await res.json();
  return (data.features ?? []).map((f: any) => ({
    id: f.id,
    place: f.properties.place ?? "Unknown",
    magnitude: f.properties.mag ?? 0,
    time: f.properties.time,
    depth: f.geometry?.coordinates?.[2] ?? 0,
    longitude: f.geometry?.coordinates?.[0] ?? 0,
    latitude: f.geometry?.coordinates?.[1] ?? 0,
    url: f.properties.url,
  }));
}

export function magnitudeSeverity(m: number): Severity {
  if (m >= 6) return "Critical";
  if (m >= 5) return "High";
  if (m >= 4) return "Medium";
  return "Low";
}
