/**
 * ACLED HTTP Client — Server Only
 *
 * Wraps the ACLED REST API with:
 *   • Bearer token injection (via auth.ts)
 *   • Automatic token refresh on 401 (one attempt)
 *   • Rate-limit detection (429) with configurable back-off
 *   • Structured error types for clean error handling in route handlers
 *   • Typed query parameters for all supported endpoints
 *
 * THIS FILE MUST NEVER BE IMPORTED FROM CLIENT-SIDE CODE.
 *
 * Adding a new ACLED endpoint:
 *   1. Add a typed `*Params` interface below
 *   2. Add a method on `AcledClient` that calls `this.get()`
 *   3. That's it — auth, retries, and error handling are automatic
 */
import { getAcledToken, invalidateAcledToken, AcledAuthError } from "./auth";

// ─── Configuration ────────────────────────────────────────────────────────────

const ACLED_API_BASE = "https://api.acleddata.com";
const ACLED_READ_PATH = "/acled/read";

/** Fields requested from ACLED — keeps the payload lean and avoids unused data. */
export const ACLED_FIELDS = [
  "event_id_cnty",
  "event_date",
  "event_type",
  "sub_event_type",
  "actor1",
  "actor2",
  "assoc_actor_1",
  "country",
  "iso",
  "admin1",
  "admin2",
  "location",
  "latitude",
  "longitude",
  "geo_precision",
  "fatalities",
  "notes",
  "source",
  "source_scale",
  "timestamp",
].join("|");

// ─── Error types ──────────────────────────────────────────────────────────────

export class AcledApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AcledApiError";
  }
}

export class AcledRateLimitError extends AcledApiError {
  constructor(public readonly retryAfterSec: number) {
    super(`ACLED rate limit — retry after ${retryAfterSec}s`, 429, true);
    this.name = "AcledRateLimitError";
  }
}

// ─── Query parameter interfaces ───────────────────────────────────────────────

interface BaseQueryParams {
  limit?: number;
  page?: number;
  /** ISO-3166 alpha-2 country code or full country name */
  country?: string;
  /** ACLED region name (e.g. "Western Africa") */
  region?: string;
  /** Comma-separated ISO numeric region codes */
  region_num?: string;
  event_date?: string;
  event_date_where?: ">=" | "<=" | "BETWEEN";
  event_date_end?: string;
  event_type?: string;
}

export interface LatestEventsParams extends BaseQueryParams {
  limit?: number;
  daysBack?: number;
}

export interface CountryEventsParams extends BaseQueryParams {
  country: string;
  daysBack?: number;
}

export interface RegionEventsParams extends BaseQueryParams {
  region: string;
  daysBack?: number;
}

export interface ConflictEventsParams extends BaseQueryParams {
  daysBack?: number;
}

// ─── Raw response shape ───────────────────────────────────────────────────────

export interface AcledApiResponse {
  status: number;
  success: boolean;
  last_update: number;
  count: number;
  data: AcledRawRecord[];
  error?: string;
}

export interface AcledRawRecord {
  event_id_cnty: string;
  event_date: string;
  year?: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2?: string;
  assoc_actor_1?: string;
  country: string;
  iso?: string;
  admin1?: string;
  admin2?: string;
  location: string;
  latitude: string;
  longitude: string;
  geo_precision?: string;
  fatalities: string;
  notes: string;
  source?: string;
  source_scale?: string;
  timestamp?: string;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function dateWindowStart(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ─── ACLED client ─────────────────────────────────────────────────────────────

export class AcledClient {
  /**
   * Low-level authenticated GET to the ACLED /acled/read endpoint.
   *
   * On 401: invalidates token + retries once with a fresh token.
   * On 429: throws `AcledRateLimitError` — caller decides back-off strategy.
   * On 5xx: throws retryable `AcledApiError`.
   */
  private async get(params: Record<string, string | number | undefined>): Promise<AcledRawRecord[]> {
    let token: string;
    try {
      token = await getAcledToken();
    } catch (e) {
      if (e instanceof AcledAuthError) {
        console.error("[AcledClient] auth failed:", e.message);
        return [];
      }
      throw e;
    }

    const url = new URL(ACLED_READ_PATH, ACLED_API_BASE);
    url.searchParams.set("fields", ACLED_FIELDS);

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }

    const attemptFetch = async (authToken: string): Promise<Response> => {
      return fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });
    };

    let res = await attemptFetch(token);

    // Token expired → refresh once
    if (res.status === 401) {
      console.warn("[AcledClient] 401 — refreshing token");
      invalidateAcledToken();
      try {
        token = await getAcledToken();
        res = await attemptFetch(token);
      } catch (e) {
        console.error("[AcledClient] token refresh failed:", e);
        return [];
      }
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      throw new AcledRateLimitError(retryAfter);
    }

    if (!res.ok) {
      const retryable = res.status >= 500;
      throw new AcledApiError(`ACLED API HTTP ${res.status}`, res.status, retryable);
    }

    let body: AcledApiResponse;
    try {
      body = await res.json();
    } catch {
      throw new AcledApiError("ACLED response was not valid JSON", 502, false);
    }

    if (!body.success) {
      console.warn("[AcledClient] API returned success=false:", body.error);
      return [];
    }

    return body.data ?? [];
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  /** Most recent events globally (default: last 7 days, up to 200 records). */
  async getLatestEvents(params: LatestEventsParams = {}): Promise<AcledRawRecord[]> {
    const { daysBack = 7, limit = 200, ...rest } = params;
    return this.get({
      event_date: dateWindowStart(daysBack),
      event_date_where: ">=",
      limit,
      ...rest,
    });
  }

  /** Events for a single country (default: last 30 days). */
  async getCountryEvents(params: CountryEventsParams): Promise<AcledRawRecord[]> {
    const { country, daysBack = 30, limit = 100, ...rest } = params;
    return this.get({
      country,
      event_date: dateWindowStart(daysBack),
      event_date_where: ">=",
      limit,
      ...rest,
    });
  }

  /** Events within an ACLED region (default: last 14 days). */
  async getRegionEvents(params: RegionEventsParams): Promise<AcledRawRecord[]> {
    const { region, daysBack = 14, limit = 150, ...rest } = params;
    return this.get({
      region,
      event_date: dateWindowStart(daysBack),
      event_date_where: ">=",
      limit,
      ...rest,
    });
  }

  /**
   * Armed conflict events only (Battles + Explosions/Remote violence).
   * Default: last 7 days globally.
   */
  async getConflictEvents(params: ConflictEventsParams = {}): Promise<AcledRawRecord[]> {
    const { daysBack = 7, limit = 150, ...rest } = params;
    return this.get({
      event_type: "Battles|Explosions/Remote violence|Violence against civilians",
      event_date: dateWindowStart(daysBack),
      event_date_where: ">=",
      limit,
      ...rest,
    });
  }
}

/** Module-level singleton — reuse the same auth state across requests. */
export const acledClient = new AcledClient();
