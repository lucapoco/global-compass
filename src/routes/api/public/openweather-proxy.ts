import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side OpenWeather proxy.
 *
 * Previously `src/services/weatherApi.ts` called `api.openweathermap.org`
 * directly from the BROWSER using `VITE_OPENWEATHER_API_KEY` — since Vite
 * inlines every `VITE_*` variable into the client bundle, that key was
 * plainly visible to anyone opening devtools (security audit finding).
 *
 * This proxy keeps the key server-only (`OPENWEATHER_API_KEY`) and forwards only
 * a sanitized `city` query param. If no key is configured, it returns
 * `not_configured` and the client falls back to demo weather data.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches weatherProvider's per-city TTL
const cacheByCity = new Map<string, { data: unknown; fetchedAt: number }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function readKey(): string | undefined {
  const key = process.env.OPENWEATHER_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

function safeMessage(raw: string, key: string | undefined): string {
  return key ? raw.replaceAll(key, "***") : raw;
}

export const Route = createFileRoute("/api/public/openweather-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const key = readKey();
        if (!key) {
          return json({ ok: false, error: "not_configured", message: "Set OPENWEATHER_API_KEY to enable live weather." }, 503);
        }

        const url = new URL(request.url);
        const city = (url.searchParams.get("city") ?? "").trim().slice(0, 100);
        if (!city) return json({ ok: false, error: "bad_request", message: "Missing `city` query param." }, 400);

        // A lightweight config probe (used by UI status badges) — never hits upstream.
        if (url.searchParams.get("probe") === "1") {
          return json({ ok: true, configured: true });
        }

        const cacheKey = city.toLowerCase();
        const cached = cacheByCity.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, data: cached.data, source: "cached" });
        }

        const upstream = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${key}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal });
          clearTimeout(timer);

          if (res.status === 401) return json({ ok: false, error: "invalid_key", message: "OpenWeather API key is invalid." }, 401);
          if (res.status === 404) return json({ ok: false, error: "not_found", message: `City "${city}" was not found.` }, 404);
          if (res.status === 429) return json({ ok: false, error: "rate_limited", message: "OpenWeather rate limit reached. Try again shortly." }, 429);

          if (!res.ok) {
            const message = safeMessage(`OpenWeather responded ${res.status}`, key);
            if (cached) return json({ ok: true, data: cached.data, source: "cached", message }, 200);
            return json({ ok: false, error: "upstream_error", message }, 502);
          }

          const data = await res.json();
          cacheByCity.set(cacheKey, { data, fetchedAt: Date.now() });
          return json({ ok: true, data, source: "live" });
        } catch (e) {
          const message = safeMessage(e instanceof Error ? e.message : String(e), key);
          if (cached) return json({ ok: true, data: cached.data, source: "cached", message }, 200);
          return json({ ok: false, error: "network_error", message: `Could not reach OpenWeather: ${message}` }, 502);
        }
      },
    },
  },
});
