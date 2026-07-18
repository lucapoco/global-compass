import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side ReliefWeb (UN OCHA) proxy.
 *
 * ReliefWeb aggregates humanitarian crisis reporting: active disasters,
 * displacement, conflict-driven humanitarian needs, and situation reports.
 *
 * Endpoint: https://api.reliefweb.int/v2/disasters
 *
 * Since 1 Nov 2025, ReliefWeb requires a pre-approved `appname` (unapproved
 * values return HTTP 403 — request one for free at
 * https://apidoc.reliefweb.int/parameters#appname). The server-only
 * `RELIEFWEB_APPNAME` env var holds it; if unset, this endpoint returns
 * `not_configured` and the client provider degrades gracefully (identical
 * pattern to the ACLED / NASA FIRMS providers) instead of hammering the
 * upstream API with requests that are guaranteed to fail.
 *
 * Returns current disasters with country, type, and date metadata.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const BASE_URL = "https://api.reliefweb.int/v2/disasters";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
  return Boolean(process.env.RELIEFWEB_APPNAME?.trim());
}

export const Route = createFileRoute("/api/public/reliefweb-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        if (!isConfigured()) {
          return json({
            ok: false,
            error: "not_configured",
            message: "Set RELIEFWEB_APPNAME (free approval at apidoc.reliefweb.int/parameters#appname) to enable humanitarian crisis data.",
          }, 503);
        }

        const url = new URL(request.url);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 60)));

        if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
          return json({ ok: true, data: cache.data, source: "cached", fetchedAt: cache.fetchedAt });
        }

        const params = new URLSearchParams({
          appname: process.env.RELIEFWEB_APPNAME!.trim(),
          "filter[field]": "status",
          "filter[value]": "current",
          "sort[]": "date:desc",
          limit: String(limit),
        });
        // ReliefWeb requires each included field as its own repeated key.
        for (const field of ["name", "country", "type", "date", "url", "primary_country", "description"]) {
          params.append("fields[include][]", field);
        }

        const upstream = `${BASE_URL}?${params.toString()}`;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(upstream, { signal: controller.signal, headers: { Accept: "application/json" } });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`ReliefWeb responded ${res.status}`);
          const body = await res.json();
          const items = Array.isArray((body as { data?: unknown[] })?.data)
            ? (body as { data: unknown[] }).data
            : [];

          cache = { data: items, fetchedAt: Date.now() };
          return json({ ok: true, data: items, source: "live", fetchedAt: cache.fetchedAt });
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
