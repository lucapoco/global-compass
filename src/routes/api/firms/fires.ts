import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side NASA FIRMS (Fire Information for Resource Management System) proxy.
 *
 * Provides near-real-time satellite-detected active fire hotspots
 * (VIIRS/MODIS). Requires a free MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/)
 * — never exposed to the browser, read from the server-only `FIRMS_MAP_KEY`
 * env var. If unset, the endpoint returns `not_configured` and the client
 * provider degrades gracefully (identical pattern to the ACLED provider).
 *
 * Endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{BBOX}/{DAYS}
 * Response: CSV with header `latitude,longitude,brightness,scan,track,acq_date,
 *   acq_time,satellite,confidence,version,bright_t31,frp,daynight`
 *
 * Rate limit: 5,000 transactions / 10 minutes per MAP_KEY — a 1-day "world"
 * query is a single transaction, cached here for 20 minutes to stay far
 * under any reasonable usage.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const ALLOWED_FIRMS_SENSORS = new Set([
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
]);
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

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

function isConfigured(): boolean {
  return Boolean(process.env.FIRMS_MAP_KEY?.trim());
}

/** Parses the FIRMS area CSV into row objects — no dependency, header-driven. */
function parseFirmsCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    if (cols.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i]?.trim() ?? ""; });
    rows.push(row);
  }
  return rows;
}

export const Route = createFileRoute("/api/firms/fires")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        if (!isConfigured()) {
          return json({
            ok: false,
            error: "not_configured",
            message: "Set FIRMS_MAP_KEY (free registration at firms.modaps.eosdis.nasa.gov/api/) to enable active fire detection.",
          }, 503);
        }

        const url = new URL(request.url);
        const dayRange = Math.min(5, Math.max(1, Number(url.searchParams.get("days") ?? 1)));
        const rawSensor = url.searchParams.get("sensor") ?? "VIIRS_SNPP_NRT";
        const source = ALLOWED_FIRMS_SENSORS.has(rawSensor) ? rawSensor : "VIIRS_SNPP_NRT";

        if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, data: cache.data, source: "cached", fetchedAt: cache.fetchedAt });
        }

        const mapKey = process.env.FIRMS_MAP_KEY!.trim();
        const upstream = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/world/${dayRange}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15_000);
          const res = await fetch(upstream, { signal: controller.signal });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`FIRMS responded ${res.status}`);
          const csv = await res.text();
          const rows = parseFirmsCsv(csv).slice(0, 500); // cap payload size for map rendering

          cache = { data: rows, fetchedAt: Date.now() };
          return json({ ok: true, data: rows, source: "live", fetchedAt: cache.fetchedAt });
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
