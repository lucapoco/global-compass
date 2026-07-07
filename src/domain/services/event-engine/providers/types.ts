import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import type { ProviderCacheStatus } from "../cache/providerCache";

export interface ProviderLoadContext {
  /** Bypass the provider's own cache/rate-limit reuse and force a fresh fetch when possible. */
  force?: boolean;
}

export interface ProviderStatusSnapshot {
  id: GlobalEventProvider;
  label: string;
  status: ProviderCacheStatus;
  ttlMs: number;
  lastRefreshAt: number | null;
  itemCount: number;
  error?: string;
}

export interface EventProvider {
  id: GlobalEventProvider;
  label: string;
  ttlMs: number;
  load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]>;
  getStatus(): ProviderStatusSnapshot;
}
