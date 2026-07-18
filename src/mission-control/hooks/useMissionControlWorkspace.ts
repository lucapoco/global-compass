/**
 * useMissionControlWorkspace — load/save per-user MC settings with optimistic UI.
 * Guests use local defaults only (no cloud sync).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth";
import {
  DEFAULT_MC_WORKSPACE,
  getMissionControlWorkspace,
  updateMissionControlWorkspace,
  type MissionControlWorkspace,
} from "@/services/missionControlWorkspace";
import type { PresentationConfig } from "../types";
import { DEFAULT_PRESENTATION } from "../types";

export function useMissionControlWorkspace() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<MissionControlWorkspace>(DEFAULT_MC_WORKSPACE);
  const [loading, setLoading] = useState(false);
  const [presentation, setPresentation] = useState<PresentationConfig>(DEFAULT_PRESENTATION);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setWorkspace(DEFAULT_MC_WORKSPACE);
      setPresentation(DEFAULT_PRESENTATION);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getMissionControlWorkspace()
      .then((ws) => {
        if (cancelled) return;
        setWorkspace(ws);
        setPresentation({
          ...DEFAULT_PRESENTATION,
          ...(ws.presentation ?? {}),
        });
      })
      .catch(() => {
        if (!cancelled) setWorkspace(DEFAULT_MC_WORKSPACE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading]);

  const persist = useCallback(
    (patch: Partial<MissionControlWorkspace>) => {
      setWorkspace((prev) => ({ ...prev, ...patch }));

      if (!isAuthenticated) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateMissionControlWorkspace(patch).catch(() => {
          /* keep optimistic local state */
        });
      }, 400);
    },
    [isAuthenticated],
  );

  const updatePresentation = useCallback(
    (next: PresentationConfig | ((prev: PresentationConfig) => PresentationConfig)) => {
      setPresentation((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (isAuthenticated) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            void updateMissionControlWorkspace({ presentation: value }).catch(() => {});
          }, 400);
        }
        return value;
      });
    },
    [isAuthenticated],
  );

  return {
    workspace,
    loading,
    presentation,
    setPresentation: updatePresentation,
    persist,
    isSynced: isAuthenticated,
  };
}
