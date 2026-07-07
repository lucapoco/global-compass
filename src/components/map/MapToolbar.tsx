import { RefreshCw, Maximize2, Minimize2, PanelRightOpen, PanelRightClose, Flame, MapPin, Layers3, X, Crosshair, History } from "lucide-react";
import type { MapVisualizationMode } from "@/domain/services/map-engine";

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

const VIS_MODES: { id: MapVisualizationMode; label: string; icon: typeof MapPin }[] = [
  { id: "markers", label: "Markers", icon: MapPin },
  { id: "heatmap", label: "Heatmap", icon: Flame },
  { id: "both", label: "Both", icon: Layers3 },
];

export function MapToolbar({
  state, onRefresh, onResetView, onToggleFullscreen, onToggleSidePanel,
  onSetVisualizationMode, onToggleReplay, onClearFilters,
}: Props) {
  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <button onClick={onRefresh} disabled={state.loading} className={btn(false) + " disabled:opacity-50"} title="Refresh map data">
        <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? "animate-spin" : ""}`} /> Refresh
      </button>
      <button onClick={onResetView} className={btn(false)} title="Reset to global view">
        <Crosshair className="h-3.5 w-3.5" /> Reset view
      </button>
      <button onClick={onToggleFullscreen} className={btn(state.fullscreen)} title="Toggle fullscreen">
        {state.fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        Fullscreen
      </button>
      <button onClick={onToggleSidePanel} className={btn(state.sidePanel)} title="Toggle side panel">
        {state.sidePanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        Side panel
      </button>
      <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" />
      {VIS_MODES.map((m) => {
        const Icon = m.icon;
        return (
          <button key={m.id} onClick={() => onSetVisualizationMode(m.id)} className={btn(state.visualizationMode === m.id)} title={`Show ${m.label.toLowerCase()}`}>
            <Icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        );
      })}
      <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" />
      <button onClick={onToggleReplay} className={btn(state.replayActive)} title="Chronological replay mode">
        <History className="h-3.5 w-3.5" /> Replay
      </button>
      <button onClick={onClearFilters} className={btn(false)} title="Clear all filters">
        <X className="h-3.5 w-3.5" /> Clear filters
      </button>
    </div>
  );
}
