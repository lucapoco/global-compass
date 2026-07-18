import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "simple" | "advanced";
const STORAGE_KEY = "global_pulse_view_mode";

interface Ctx {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  isSimple: boolean;
  isAdvanced: boolean;
}

const ViewModeContext = createContext<Ctx | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("advanced");

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "simple" || v === "advanced") setViewModeState(v);
    } catch {
      // localStorage unavailable (private browsing, SSR) — keep the default view mode
    }
  }, []);

  function setViewMode(m: ViewMode) {
    setViewModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // localStorage unavailable — preference just won't persist across reloads
    }
  }

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isSimple: viewMode === "simple", isAdvanced: viewMode === "advanced" }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): Ctx {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used inside ViewModeProvider");
  return ctx;
}
