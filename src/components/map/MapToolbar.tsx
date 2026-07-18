import { RefreshCw, Maximize2, Minimize2, PanelRightOpen, PanelRightClose, Flame, MapPin, Layers3, X, Crosshair, History } from "lucide-react";
import type { MapVisualizationMode } from "@/domain/services/map-engine";
import { useT } from "@/i18n";

export interface MapToolbarState {
  loading: boolean;
  fullscreen: boolean;
  sidePanel: boolean;
  visualizationMode: MapVisualizationMode;
  replayActive: boolean;
}

interface Props {
  state: MapToolbarState;
  onRefresh: () => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  onToggleSidePanel: () => void;
  onSetVisualizationMode: (mode: MapVisualizationMode) => void;
  onToggleReplay: () => void;
  onClearFilters: () => void;
}

function btn(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapToolbar({
  state, onRefresh, onResetView, onToggleFullscreen, onToggleSidePanel,
  onSetVisualizationMode, onToggleReplay, onClearFilters,
}: Props) {
  const t = useT();

  const visModes: { id: MapVisualizationMode; label: string; icon: typeof MapPin }[] = [
    { id: "markers", label: t("app.pages.map.ui.markers"), icon: MapPin },
    { id: "heatmap", label: t("app.pages.map.ui.heatmap"), icon: Flame },
    { id: "both", label: t("app.pages.map.ui.both"), icon: Layers3 },
  ];

  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <button onClick={onRefresh} disabled={state.loading} className={btn(false) + " disabled:opacity-50"} title={t("app.pages.map.ui.refreshTitle")}>
        <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? "animate-spin" : ""}`} /> {t("app.ui.refresh")}
      </button>
      <button onClick={onResetView} className={btn(false)} title={t("app.pages.map.ui.resetViewTitle")}>
        <Crosshair className="h-3.5 w-3.5" /> {t("app.pages.map.resetView")}
      </button>
      <button onClick={onToggleFullscreen} className={btn(state.fullscreen)} title={t("app.pages.map.ui.toggleFullscreen")}>
        {state.fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {t("app.pages.map.ui.fullscreen")}
      </button>
      <button onClick={onToggleSidePanel} className={btn(state.sidePanel)} title={t("app.pages.map.ui.toggleSidePanel")}>
        {state.sidePanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        {t("app.pages.map.ui.sidePanel")}
      </button>
      <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" />
      {visModes.map((m) => {
        const Icon = m.icon;
        return (
          <button key={m.id} onClick={() => onSetVisualizationMode(m.id)} className={btn(state.visualizationMode === m.id)} title={t("app.pages.map.ui.showMode", { mode: m.label.toLowerCase() })}>
            <Icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        );
      })}
      <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" />
      <button onClick={onToggleReplay} className={btn(state.replayActive)} title={t("app.pages.map.ui.replayTitle")}>
        <History className="h-3.5 w-3.5" /> {t("app.pages.map.ui.replay")}
      </button>
      <button onClick={onClearFilters} className={btn(false)} title={t("app.pages.map.ui.clearFiltersTitle")}>
        <X className="h-3.5 w-3.5" /> {t("app.pages.map.ui.clearFilters")}
      </button>
    </div>
  );
}
