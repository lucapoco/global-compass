import { createFileRoute } from "@tanstack/react-router";
import { acledClient, AcledRateLimitError, type AcledRawRecord } from "@/server/acled/client";
import { isAcledConfigured, getAcledAuthStatus } from "@/server/acled/auth";

/**
 * Server-side ACLED proxy route — GET /api/acled/events
 *
 * Credentials (`ACLED_USERNAME`, `ACLED_PASSWORD`) are read exclusively from
 * `process.env` on the server — never exposed to the browser bundle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUERY PARAMETERS
 * ─────────────────────────────────────────────────────────────────────────
 *   mode        "latest" | "country" | "region" | "conflict"
 *               Default: "latest"
 *
 *   country     Country name (required when mode=country)
 *
 *   region      ACLED region name (required when mode=region)
 *
 *   limit       Max records to return (default: 200, max: 500)
 *
 *   daysBack    How many calendar days to look back (default: 7, max: 90)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RESPONSE
 * ─────────────────────────────────────────────────────────────────────────
 *   200  { ok: true, data: AcledRawRecord[], count: number, fetchedAt: string }
 *   503  { ok: false, error: "not_configured", message: string }
 *   429  { ok: false, error: "rate_limited", retryAfterSec: number }
 *   502  { ok: false, error: "upstream_error", message: string }
 *   500  { ok: false, error: "server_error", message: string }
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const Route = createFileRoute("/api/acled/events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        // ── Guard: credentials must be configured ─────────────────────────
        if (!isAcledConfigured()) {
          return json(
            {
              ok: false,
              error: "not_configured",
              message:
                "ACLED integration is not configured. Set ACLED_USERNAME and ACLED_PASSWORD on the server.",
            },
            503,
          );
        }

        const url = new URL(request.url);
        const q = url.searchParams;

        // ── Parse parameters ──────────────────────────────────────────────
        const mode = (q.get("mode") ?? "latest") as
          | "latest"
          | "country"
          | "region"
          | "conflict";

        const country = q.get("country")?.slice(0, 100) ?? undefined;
        const region = q.get("region")?.slice(0, 100) ?? undefined;

        const rawLimit = parseInt(q.get("limit") ?? "200", 10);
        const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 200, 1, 500);

        const rawDays = parseInt(q.get("daysBack") ?? "7", 10);
        const daysBack = clamp(Number.isFinite(rawDays) ? rawDays : 7, 1, 90);

        // ── Dispatch to client method ──────────────────────────────────────
        let data: AcledRawRecord[];

        try {
          switch (mode) {
            case "country": {
              if (!country) {
                return json(
                  { ok: false, error: "missing_param", message: "country is required for mode=country" },
                  400,
                );
              }
              data = await acledClient.getCountryEvents({ country, daysBack, limit });
              break;
            }

            case "region": {
              if (!region) {
                return json(
                  { ok: false, error: "missing_param", message: "region is required for mode=region" },
                  400,
                );
              }
              data = await acledClient.getRegionEvents({ region, daysBack, limit });
              break;
            }

            case "conflict": {
              data = await acledClient.getConflictEvents({ daysBack, limit });
              break;
            }

            case "latest":
            default: {
              data = await acledClient.getLatestEvents({ daysBack, limit });
              break;
            }
          }
        } catch (e) {
          if (e instanceof AcledRateLimitError) {
            console.warn("[/api/acled/events] rate limited, retry after", e.retryAfterSec, "s");
            return json(
              {
                ok: false,
                error: "rate_limited",
                message: `ACLED rate limit — retry after ${e.retryAfterSec}s`,
                retryAfterSec: e.retryAfterSec,
              },
              429,
            );
          }

          const message = e instanceof Error ? e.message : String(e);
          console.error("[/api/acled/events] upstream error:", message);
          return json(
            { ok: false, error: "upstream_error", message: `ACLED request failed: ${message}` },
            502,
          );
        }

        // ── Success ───────────────────────────────────────────────────────
        return json({
          ok: true,
          data,
          count: data.length,
          fetchedAt: new Date().toISOString(),
          // Diagnostic (never includes token or credentials)
          _auth: getAcledAuthStatus(),
        });
      },
    },
  },
});
