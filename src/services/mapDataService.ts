import type { MapEvent } from "@/types";
import { getEarthquakes, magnitudeSeverity } from "./earthquakesApi";
import { supabaseService, isSupabaseConfigured } from "./supabaseService";
import { fetchIntelligence } from "./newsApi";
import { getAllCountries } from "./countriesApi";
import { demoMapEvents } from "@/data/demoMapEvents";

const sevMap = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

export async function collectMapEvents(): Promise<MapEvent[]> {
  const events: MapEvent[] = [];

  try {
    const quakes = await getEarthquakes("day");
    for (const q of quakes.slice(0, 200)) {
      events.push({
        id: `eq-${q.id}`, lat: q.latitude, lng: q.longitude, type: "earthquake",
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        description: `Depth ${q.depth.toFixed(1)} km`,
        severity: magnitudeSeverity(q.magnitude),
        url: q.url,
      });
    }
  } catch (e) { console.warn("earthquake feed failed", e); }

  // Intelligence — geocode by country capital using REST Countries
  try {
    const news = await fetchIntelligence({ max: 25 });
    let capitals: Map<string, [number, number]> | null = null;
    const needsGeocode = news.items.filter((i) => i.country && (i.latitude == null || i.longitude == null));
    if (needsGeocode.length) {
      try {
        const all = await getAllCountries();
        capitals = new Map();
        for (const c of all) {
          if (c.latlng?.length === 2) capitals.set(c.name.common.toLowerCase(), [c.latlng[0], c.latlng[1]]);
        }
      } catch {}
    }
    for (const i of news.items) {
      let lat = i.latitude, lng = i.longitude;
      if ((lat == null || lng == null) && i.country && capitals) {
        const ll = capitals.get(i.country.toLowerCase());
        if (ll) { lat = ll[0]; lng = ll[1]; }
      }
      if (lat == null || lng == null) continue;
      events.push({
        id: `intel-${i.id}`, lat, lng, type: "intelligence",
        title: i.title,
        description: `${i.category} · ${i.source}`,
        severity: sevMap[i.severity],
        category: i.category,
        url: i.url,
      });
    }
  } catch (e) { console.warn("news feed failed", e); }

  if (isSupabaseConfigured()) {
    try {
      const saved = await supabaseService.listSavedAlerts();
      for (const a of saved) {
        const m = a.location?.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
        if (m) {
          events.push({
            id: `sa-${a.id}`, lat: parseFloat(m[1]), lng: parseFloat(m[2]),
            type: "alert", title: a.title, description: a.description ?? "",
            severity: a.severity as MapEvent["severity"],
          });
        }
      }
    } catch {}
  }

  for (const d of demoMapEvents) events.push(d);
  return events;
}
