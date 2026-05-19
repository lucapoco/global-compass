import type { Country, EventCategory, EventLayer, EventSeverity, GlobalEvent, IntelligenceSeverity } from "@/types";
import { getEarthquakes } from "./earthquakesApi";
import { supabaseService, isSupabaseConfigured } from "./supabaseService";
import { fetchIntelligence } from "./newsApi";
import { getAllCountries } from "./countriesApi";

function magToSeverity(m: number): EventSeverity {
  if (m >= 6) return "critical";
  if (m >= 5) return "high";
  if (m >= 4) return "medium";
  return "low";
}

function intelSeverityToEvent(s: IntelligenceSeverity): EventSeverity {
  return s;
}

function normalizeSavedSeverity(raw: string): EventSeverity {
  const x = raw.trim().toLowerCase();
  if (x === "critical" || x === "high" || x === "medium" || x === "low") return x as EventSeverity;
  return "low";
}

function alertTypeToCategory(type: string | undefined): EventCategory {
  const t = (type ?? "").toLowerCase();
  if (t.includes("weather")) return "weather";
  if (t.includes("earthquake") || t.includes("quake")) return "earthquake";
  if (t.includes("military")) return "military";
  if (t.includes("economy")) return "economy";
  return "general";
}

const DEMO_WEATHER: GlobalEvent[] = [
  {
    id: "wx-demo-natl",
    title: "Demo: North Atlantic pressure pattern",
    description: "Illustrative weather layer point (no live feed wired here).",
    category: "weather",
    severity: "low",
    layer: "weather",
    source: "Demo",
    latitude: 50,
    longitude: -40,
    publishedAt: new Date().toISOString(),
    isLive: false,
    isDemo: true,
  },
  {
    id: "wx-demo-pac",
    title: "Demo: Pacific trade-wind belt",
    category: "weather",
    severity: "medium",
    layer: "weather",
    source: "Demo",
    latitude: 5,
    longitude: -150,
    publishedAt: new Date().toISOString(),
    isLive: false,
    isDemo: true,
  },
];

/** Loads and normalizes all map sources into `GlobalEvent[]` (side panel = full list; markers = coords only). */
export async function collectGlobalMapEvents(): Promise<GlobalEvent[]> {
  const events: GlobalEvent[] = [];

  try {
    const quakes = await getEarthquakes("day");
    for (const q of quakes.slice(0, 200)) {
      events.push({
        id: `eq-${q.id}`,
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        description: `Depth ${q.depth.toFixed(1)} km`,
        category: "earthquake",
        severity: magToSeverity(q.magnitude),
        layer: "earthquakes",
        source: "USGS",
        url: q.url,
        location: q.place,
        latitude: q.latitude,
        longitude: q.longitude,
        publishedAt: new Date(q.time).toISOString(),
        isLive: true,
      });
    }
  } catch (e) {
    console.warn("earthquake feed failed", e);
  }

  try {
    const news = await fetchIntelligence({ max: 40 });
    let capitals: Map<string, [number, number]> | null = null;
    const needsGeocode = news.items.filter((i) => i.country && (i.latitude == null || i.longitude == null));
    if (needsGeocode.length) {
      try {
        const all = await getAllCountries();
        capitals = new Map();
        for (const c of all) {
          if (c.latlng?.length === 2) capitals.set(c.name.common.toLowerCase(), [c.latlng[0], c.latlng[1]]);
        }
      } catch {
        capitals = null;
      }
    }
    for (const i of news.items) {
      let lat = i.latitude;
      let lng = i.longitude;
      if ((lat == null || lng == null) && i.country && capitals) {
        const ll = capitals.get(i.country.toLowerCase());
        if (ll) {
          lat = ll[0];
          lng = ll[1];
        }
      }
      const cat = (i.category ?? "general") as EventCategory;
      events.push({
        id: `intel-${i.id}`,
        title: i.title,
        description: i.description,
        category: cat,
        severity: intelSeverityToEvent(i.severity),
        layer: "intelligence",
        source: i.source,
        url: i.url,
        country: i.country,
        location: i.country,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        publishedAt: i.publishedAt,
        isLive: Boolean(i.isLive),
      });
    }
  } catch (e) {
    console.warn("news feed failed", e);
  }

  if (isSupabaseConfigured()) {
    try {
      const saved = await supabaseService.listSavedAlerts();
      for (const a of saved) {
        const m = a.location?.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
        events.push({
          id: `sa-${a.id}`,
          title: a.title,
          description: a.description ?? undefined,
          category: alertTypeToCategory(a.type),
          severity: normalizeSavedSeverity(a.severity),
          layer: "saved_alerts",
          source: a.source ?? "Supabase",
          url: undefined,
          location: a.location ?? undefined,
          latitude: m ? parseFloat(m[1]) : undefined,
          longitude: m ? parseFloat(m[2]) : undefined,
          publishedAt: a.created_at ?? new Date().toISOString(),
          isLive: true,
          isSaved: true,
        });
      }
    } catch (e) {
      console.warn("saved alerts load failed", e);
    }
  }

  events.push(...DEMO_WEATHER);

  try {
    const all: Country[] = await getAllCountries();
    let n = 0;
    for (const c of all) {
      if (n >= 200) break;
      if (!c.latlng || c.latlng.length < 2) continue;
      const [lat, lng] = c.latlng;
      events.push({
        id: `cap-${c.cca3 ?? c.name.common}`,
        title: c.capital?.[0] ? `${c.capital[0]} (${c.name.common})` : c.name.common,
        description: c.region ? `${c.region}` : undefined,
        category: "general",
        severity: "low",
        layer: "capitals",
        source: "REST Countries",
        country: c.name.common,
        location: c.capital?.[0] ?? undefined,
        latitude: lat,
        longitude: lng,
        publishedAt: new Date().toISOString(),
        isLive: true,
      });
      n += 1;
    }
  } catch (e) {
    console.warn("capitals load failed", e);
  }

  return events;
}
