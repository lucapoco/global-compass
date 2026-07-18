/**
 * ACLED Authentication Manager — Server Only
 *
 * Handles the full ACLED token lifecycle:
 *   1. Read credentials from server environment variables
 *   2. POST to the ACLED auth endpoint to obtain a bearer token
 *   3. Cache the token in memory with expiry tracking
 *   4. Automatically re-authenticate before token expiry
 *   5. Retry authentication once on transient failure
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CREDENTIALS
 * ─────────────────────────────────────────────────────────────────────────
 *   ACLED_USERNAME   Your ACLED account username (email)
 *   ACLED_PASSWORD   Your ACLED account password
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CHANGING THE AUTH ENDPOINT
 * ─────────────────────────────────────────────────────────────────────────
 * If ACLED updates their authentication flow, this file is the ONLY one
 * that needs to change. All other modules (`client.ts`, provider) receive
 * an opaque string token and are auth-implementation-agnostic.
 *
 * Current implementation: POST username/password → JSON bearer token.
 * The `parseTokenResponse()` function maps the response to a normalized
 * `TokenResult`; update it when the API shape changes.
 *
 * THIS FILE MUST NEVER BE IMPORTED FROM CLIENT-SIDE (BROWSER) CODE.
 * It uses `process.env` and runs exclusively in Node.js server handlers.
 */

/** Normalized token result regardless of what the upstream API returns. */
export interface TokenResult {
  token: string;
  /** Absolute Unix epoch (ms) when the token expires. */
  expiresAt: number;
}

interface TokenCache {
  result: TokenResult;
  fetchedAt: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * ACLED v2 authentication endpoint.
 * Update this constant if ACLED changes their auth URL.
 */
const ACLED_AUTH_URL = "https://api.acleddata.com/user/auth";

/** Seconds before expiry to treat the token as already expired (safety margin). */
const EXPIRY_BUFFER_SEC = 120;

/** Maximum number of authentication attempts before surfacing an error. */
const MAX_AUTH_RETRIES = 2;

// ─── In-memory token store ────────────────────────────────────────────────────

let tokenCache: TokenCache | null = null;

// ─── Credential reader ────────────────────────────────────────────────────────

interface AcledCredentials {
  username: string;
  password: string;
}

function readCredentials(): AcledCredentials | null {
  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD?.trim();

  if (!username || !password) return null;
  return { username, password };
}

// ─── Response parser ──────────────────────────────────────────────────────────

/**
 * Adapts the raw JSON response from the ACLED auth endpoint into a
 * normalized `TokenResult`.
 *
 * Update this function if ACLED changes their token response shape.
 * Currently handles:
 *   { "access_token": string, "expires_in": number, "token_type": "Bearer" }
 *   { "token": string, "expires_at": string|number }
 */
function parseTokenResponse(body: Record<string, unknown>, now: number): TokenResult {
  // Pattern 1: OAuth2-style response
  if (typeof body.access_token === "string") {
    const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
    return {
      token: body.access_token,
      expiresAt: now + expiresIn * 1000,
    };
  }

  // Pattern 2: Direct token with timestamp
  if (typeof body.token === "string") {
    let expiresAt: number;
    if (typeof body.expires_at === "number") {
      // Unix timestamp in seconds
      expiresAt = body.expires_at > 1e10 ? body.expires_at : body.expires_at * 1000;
    } else if (typeof body.expires_at === "string") {
      expiresAt = new Date(body.expires_at).getTime();
    } else {
      expiresAt = now + 3600 * 1000; // default 1 hour
    }
    return { token: body.token, expiresAt };
  }

  throw new Error("ACLED auth response did not contain a recognisable token field");
}

// ─── Core authentication ──────────────────────────────────────────────────────

async function fetchNewToken(credentials: AcledCredentials): Promise<TokenResult> {
  const now = Date.now();

  const res = await fetch(ACLED_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new AcledAuthError("ACLED credentials rejected — check ACLED_USERNAME and ACLED_PASSWORD", res.status);
  }

  if (!res.ok) {
    throw new AcledAuthError(`ACLED auth endpoint returned HTTP ${res.status}`, res.status);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new AcledAuthError("ACLED auth response was not valid JSON", res.status);
  }

  return parseTokenResponse(body, now);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class AcledAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AcledAuthError";
  }
}

/** Returns true if the module has valid server-side credentials configured. */
export function isAcledConfigured(): boolean {
  return readCredentials() !== null;
}

/**
 * Returns a valid ACLED bearer token, re-authenticating as needed.
 *
 * Token lifecycle:
 *   - Fresh cached token → returned immediately (zero network cost)
 *   - Cached token within `EXPIRY_BUFFER_SEC` of expiry → re-authenticate
 *   - No cached token → authenticate now
 *   - On failure → retry once, then throw `AcledAuthError`
 *
 * @throws {AcledAuthError} if credentials are missing or authentication fails.
 */
export async function getAcledToken(): Promise<string> {
  const credentials = readCredentials();
  if (!credentials) {
    throw new AcledAuthError(
      "ACLED credentials not configured — set ACLED_USERNAME and ACLED_PASSWORD",
    );
  }

  // Return cached token if still fresh
  if (tokenCache) {
    const bufferMs = EXPIRY_BUFFER_SEC * 1000;
    if (tokenCache.result.expiresAt - Date.now() > bufferMs) {
      return tokenCache.result.token;
    }
  }

  // Authenticate (with one retry on transient errors)
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
    try {
      const result = await fetchNewToken(credentials);
      tokenCache = { result, fetchedAt: Date.now() };
      return result.token;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (e instanceof AcledAuthError && (e.statusCode === 401 || e.statusCode === 403)) {
        // Credential errors — no point retrying
        break;
      }
      if (attempt < MAX_AUTH_RETRIES) {
        console.warn(`[ACLED auth] attempt ${attempt} failed, retrying…`, lastError.message);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  console.error("[ACLED auth] authentication failed:", lastError?.message);
  throw lastError ?? new AcledAuthError("ACLED authentication failed");
}

/** Invalidate the cached token — forces a full re-authentication on next call. */
export function invalidateAcledToken(): void {
  tokenCache = null;
}

/** Diagnostic snapshot (never exposes the actual token value). */
export function getAcledAuthStatus(): {
  configured: boolean;
  hasToken: boolean;
  expiresAt: number | null;
  ttlSec: number | null;
} {
  const configured = isAcledConfigured();
  const hasToken = tokenCache !== null;
  const expiresAt = tokenCache?.result.expiresAt ?? null;
  const ttlSec = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : null;
  return { configured, hasToken, expiresAt, ttlSec };
}
