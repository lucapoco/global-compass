import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventEngine } from "@/domain/services/event-engine";
import type { GlobalEvent, GlobalEventProvider } from "@/domain/models/GlobalEvent";
import type { EventFilterOptions } from "@/domain/services/event-engine/filters/eventFilters";
import type { ProviderStatusSnapshot } from "@/domain/services/event-engine/providers";

export interface UseGlobalEventsOptions {
  providerIds?: GlobalEventProvider[];
  filters?: EventFilterOptions;
  query?: string;
  /** Poll interval in ms; omit/0 to disable auto-refresh. */
  refreshIntervalMs?: number;
  /** Skip the initial load (e.g. wait for a user action first). */
  enabled?: boolean;
}

export interface UseGlobalEventsResult {
  events: GlobalEvent[];
  loading: boolean;
  error: string | null;
  providerStatus: ProviderStatusSnapshot[];
  refresh: (force?: boolean) => Promise<void>;
}

/**
 * The recommended way for pages/components to consume unified GlobalEvent data.
 * Wraps the shared `eventEngine` singleton, memoizes filtering/search so re-renders
 * don't recompute expensive work, and de-duplicates in-flight loads.
 */
export function useGlobalEvents(options: UseGlobalEventsOptions = {}): UseGlobalEventsResult {
  const { providerIds, filters, query, refreshIntervalMs, enabled = true } = options;
  const [raw, setRaw] = useState<GlobalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusSnapshot[]>([]);
  const loadingRef = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const events = await eventEngine.loadAll({ providerIds, force });
        setRaw(events);
        setProviderStatus(eventEngine.getProviderStatus());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(providerIds)],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh(false);
    if (!refreshIntervalMs) return;
    const id = setInterval(() => void refresh(false), refreshIntervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh, refreshIntervalMs]);

  const events = useMemo(() => {
    let out = raw;
    if (filters) out = eventEngine.filter(out, filters);
    if (query?.trim()) out = eventEngine.search(out, query);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, JSON.stringify(filters), query]);

  return { events, loading, error, providerStatus, refresh };
}
