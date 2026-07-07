/**
 * Generic in-memory TTL cache used by every event provider. Gives each provider a
 * consistent notion of "cache timestamp", "cache status", "ttl" and "stale detection"
 * without duplicating bookkeeping logic six times.
 */
export type ProviderCacheStatus = "empty" | "fresh" | "stale" | "error";

export interface ProviderCacheEntry<T> {
  data: T;
  fetchedAt: number;
  ok: boolean;
  error?: string;
}

export class ProviderCache<T> {
  private entry: ProviderCacheEntry<T> | null = null;

  constructor(private readonly ttlMs: number) {}

  get(): ProviderCacheEntry<T> | null {
    return this.entry;
  }

  set(data: T, ok = true, error?: string): ProviderCacheEntry<T> {
    this.entry = { data, fetchedAt: Date.now(), ok, error };
    return this.entry;
  }

  isStale(now: number = Date.now()): boolean {
    if (!this.entry) return true;
    return now - this.entry.fetchedAt > this.ttlMs;
  }

  getStatus(now: number = Date.now()): ProviderCacheStatus {
    if (!this.entry) return "empty";
    if (!this.entry.ok) return "error";
    return this.isStale(now) ? "stale" : "fresh";
  }

  get ttl(): number {
    return this.ttlMs;
  }

  lastRefreshAt(): number | null {
    return this.entry?.fetchedAt ?? null;
  }

  clear() {
    this.entry = null;
  }
}
