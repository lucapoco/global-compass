import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side GDACS (Global Disaster Alert and Coordination System) proxy.
 *
 * GDACS is a UN/European Commission-backed multi-hazard early-warning
 * platform covering earthquakes, tropical cyclones, floods, volcanoes,
 * droughts, and wildfires worldwide.
 *
 * Endpoint documented at:
 *   https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH
 *
 * Verified contract (no API key required):
 *   GET ?fromdate=YYYY-MM-DD&todate=YYYY-MM-DD&eventlist=EQ,TC,FL,VO,DR,WF&alertlevel=Green;Orange;Red
 *   → GeoJSON FeatureCollection, properties: eventid, episodeid, eventtype,
 *     name, alertlevel, alertscore, fromdate, todate, country, iso3, glide,
 *     severitydata: { severity, severitytext, severityunit }.
 *
 * The upstream API caps every response at 100 most-recent events with no
 * pagination — we request a 14-day window by default which stays well
 * under that cap for typical event volumes.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const BASE_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}
let cache: CacheEntry | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/gdacs-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const daysBack = Math.min(60, Math.max(1, Number(url.searchParams.get("daysBack") ?? 14)));

        if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, data: cache.data, source: "cached", fetchedAt: cache.fetchedAt });
        }

        const to = new Date();
        const from = new Date(to.getTime() - daysBack * 86_400_000);
        const upstream = `${BASE_URL}?fromdate=${isoDate(from)}&todate=${isoDate(to)}&eventlist=EQ,TC,FL,VO,DR,WF&alertlevel=Green;Orange;Red`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`GDACS responded ${res.status}`);
          const geojson = await res.json();
          const features = Array.isArray((geojson as { features?: unknown[] })?.features)
            ? (geojson as { features: unknown[] }).features
            : [];

          cache = { data: features, fetchedAt: Date.now() };
          return json({ ok: true, data: features, source: "live", fetchedAt: cache.fetchedAt });
        } catch (e) {
          if (cache) {
            return json({ ok: true, data: cache.data, source: "cached", fetchedAt: cache.fetchedAt });
          }
          const message = e instanceof Error ? e.message : String(e);
          return json({ ok: false, error: "network_error", message }, 502);
        }
      },
    },
  },
});
