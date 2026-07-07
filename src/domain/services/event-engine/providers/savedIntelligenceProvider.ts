import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { normalizeSavedIntelligence } from "../normalizers/intelligenceNormalizer";
import { ProviderCache } from "../cache/providerCache";
import type { EventProvider, ProviderLoadContext, ProviderStatusSnapshot } from "./types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const TTL_MS = 60 * 1000;
const cache = new ProviderCache<GlobalEvent[]>(TTL_MS);

export const savedIntelligenceProvider: EventProvider = {
  id: "supabase_intelligence",
  label: "Supabase Saved Intelligence",
  ttlMs: TTL_MS,

  async load(ctx?: ProviderLoadContext): Promise<GlobalEvent[]> {
    if (!isSupabaseConfigured()) return [];
    const cached = cache.get();
    if (!ctx?.force && cached && !cache.isStale()) return cached.data;

    try {
      const saved = await supabaseService.listSavedIntelligence();
      const events = saved.map(normalizeSavedIntelligence);
      cache.set(events, true);
      return events;
    } catch (e) {
      const fallback = cached?.data ?? [];
      cache.set(fallback, false, e instanceof Error ? e.message : String(e));
      return fallback;
    }
  },

  getStatus(): ProviderStatusSnapshot {
    return {
      id: "supabase_intelligence",
      label: "Supabase Saved Intelligence",
      status: isSupabaseConfigured() ? cache.getStatus() : "empty",
      ttlMs: TTL_MS,
      lastRefreshAt: cache.lastRefreshAt(),
      itemCount: cache.get()?.data.length ?? 0,
      error: cache.get()?.error,
    };
  },
};
