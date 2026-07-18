/**
 * useAlertCenter — Primary React hook for the Global Alert Center page
 * and any component needing live alert/crisis data (e.g. Mission Control).
 *
 * Auto-refreshes every 2 minutes (matches the service cache TTL) and
 * pauses when the tab is hidden, avoiding unnecessary recomputation.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { refreshAlertCenter, type AlertCenterBundle } from "../services/alertCenterService";

const REFRESH_INTERVAL_MS = 2 * 60_000;

export interface UseAlertCenterResult {
  bundle: AlertCenterBundle | null;
  loading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

export function useAlertCenter(): UseAlertCenterResult {
  const [bundle, setBundle] = useState<AlertCenterBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await refreshAlertCenter(force);
      setBundle(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alert data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    timerRef.current = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    function onVisible() {
      if (!document.hidden) void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { bundle, loading, error, refresh };
}
