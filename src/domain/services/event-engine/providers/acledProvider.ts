/**
 * ACLED EventEngine provider — thin re-export of the full GPIE ACLED module.
 *
 * The implementation lives in src/domain/gpie/providers/acled/provider.ts.
 * This file exists only to maintain the flat providers/ import convention
 * used by the EventEngine's providers/index.ts.
 *
 * Authentication is handled server-side via:
 *   src/server/acled/auth.ts       — token lifecycle management
 *   src/server/acled/client.ts     — ACLED HTTP client
 *   src/routes/api/acled/events.ts — server proxy route
 *
 * The EventProvider here calls /api/acled/events (our own server route)
 * so no credentials ever reach the browser bundle.
 */
export { acledEventProvider as acledProvider } from "@/domain/gpie/providers/acled/provider";
export { acledService } from "@/domain/gpie/providers/acled/provider";
