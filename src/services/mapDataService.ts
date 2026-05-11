import type { MapEvent } from "@/types";
import { getEarthquakes, magnitudeSeverity } from "./earthquakesApi";
import { supabaseService, isSupabaseConfigured } from "./supabaseService";
import { demoMapEvents } from "@/data/demoMapEvents";

export async function collectMapEvents(): Promise<MapEvent[]> {
  const events: MapEvent[] = [];
  try {
    const quakes = await getEarthquakes("day");
    for (const q of quakes.slice(0, 200)) {
      events.push({
        id: `eq-${q.id}`,
        lat: q.latitude,
        lng: q.longitude,
        type: "earthquake",
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        description: `Depth ${q.depth.toFixed(1)} km`,
        severity: magnitudeSeverity(q.magnitude),
      });
    }
  } catch (e) {
    console.warn("earthquake feed failed", e);
  }

  if (isSupabaseConfigured()) {
    try {
      const saved = await supabaseService.listSavedAlerts();
      for (const a of saved) {
        // attempt to parse "lat,lng" if stored in location
        const m = a.location?.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
        if (m) {
          events.push({
            id: `sa-${a.id}`,
            lat: parseFloat(m[1]),
            lng: parseFloat(m[2]),
            type: "alert",
            title: a.title,
            description: a.description ?? "",
            severity: a.severity as MapEvent["severity"],
          });
        }
      }
    } catch {}
  }

  // Add some capital city markers from demo data for richer presentation
  for (const d of demoMapEvents) events.push(d);

  return events;
}
