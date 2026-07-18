/**
 * GeoIntelProvider Contract
 *
 * Every new intelligence provider (GDACS, ReliefWeb, GDELT, RSS, NASA FIRMS,
 * and any future source) implements this small, explicit contract:
 *
 *   fetch()        — retrieve raw provider-specific data (via a server proxy
 *                     when secrets/CORS require one, or directly otherwise)
 *   normalize()     — convert raw data into the unified `GlobalEvent` model
 *   cache           — a `ProviderCache` instance owned by the provider
 *   healthCheck()   — a cheap, side-effect-free reachability probe
 *
 * `toEventProvider()` adapts any `GeoIntelProvider` into the `EventProvider`
 * shape the `EventEngine` already knows how to load, cache, and report
 * status for — so every new source plugs into the existing pipeline
 * (dedup → scoring → correlation → map/timeline/graph) with zero engine
 * changes.
 */
import { ProviderCache } from "@/domain/services/event-engine/cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "@/domain/services/event-engine/providers/types";
import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";

export interface ProviderHealth {
  ok: boolean;
  message: string;
  checkedAt: string;
}

export interface GeoIntelProvider<TRaw = unknown> {
  id: GlobalEventProvider;
  label: string;
  ttlMs: number;
  /** Retrieves raw, provider-specific records (never pre-normalized). */
  fetch(ctx?: ProviderLoadContext): Promise<TRaw[]>;
  /** Converts raw records into the unified domain model. Pure — no I/O. */
  normalize(raw: TRaw[]): GlobalEvent[];
  /** Shared TTL cache for the normalized output of this provider. */
  cache: ProviderCache<GlobalEvent[]>;
  /** Cheap reachability probe — used by API Health panels and debug tooling. */
  healthCheck(): Promise<ProviderHealth>;
}

/** Adapts a `GeoIntelProvider` into the `EventEngine`'s `EventProvider` contract. */
export function toEventProvider(p: GeoIntelProvider): EventProvider {
  return {
    id: p.id,
    label: p.label,
    ttlMs: p.ttlMs,

    async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
      const cached = p.cache.get();
      if (!ctx?.force && cached && !p.cache.isStale()) return cached.data;

      try {
        const raw = await p.fetch(ctx);
        const events = p.normalize(raw);
        p.cache.set(events, true);
        return events;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const fallback = cached?.data ?? [];
        console.warn(`[GeoIntelProvider:${p.id}] load failed:`, message);
        p.cache.set(fallback, false, message);
        return fallback;
      }
    },

    getStatus(): ProviderStatusSnapshot {
      const entry = p.cache.get();
      return {
        id: p.id,
        label: p.label,
        status: p.cache.getStatus(),
        ttlMs: p.ttlMs,
        lastRefreshAt: p.cache.lastRefreshAt(),
        itemCount: entry?.data.length ?? 0,
        error: entry?.error,
      };
    },
  };
}

/** Shared helper for building a `fetch()`-based health check against a same-origin proxy. */
export async function probeProxyHealth(url: string, label: string): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { ok: false, message: `${label} proxy returned HTTP ${res.status}`, checkedAt };
    const body = await res.json().catch(() => null);
    if (body && typeof body === "object" && "ok" in body && body.ok === false) {
      const err = body as { error?: string; message?: string };
      if (err.error === "not_configured") {
        return { ok: false, message: `${label} is not configured (missing server credentials).`, checkedAt };
      }
      return { ok: false, message: err.message ?? `${label} proxy reported an error.`, checkedAt };
    }
    return { ok: true, message: `${label} reachable.`, checkedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `${label} unreachable: ${message}`, checkedAt };
  }
}
