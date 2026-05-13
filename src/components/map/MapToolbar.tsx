import { RefreshCw, Maximize2, Minimize2, PanelRightOpen, PanelRightClose, Flame, Layers, AlertTriangle, X, Crosshair } from "lucide-react";

export interface MapToolbarState {
  loading: boolean;
  fullscreen: boolean;
  sidePanel: boolean;
  heatmap: boolean;
  clusters: boolean;
  highOnly: boolean;
}

interface Props {
  state: MapToolbarState;
  onRefresh: () => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  onToggleSidePanel: () => void;
  onToggleHeatmap: () => void;
  onToggleClusters: () => void;
  onToggleHighOnly: () => void;
  onClearFilters: () => void;
  clustersSupported?: boolean;
}

function btn(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapToolbar({
  state, onRefresh, onResetView, onToggleFullscreen, onToggleSidePanel,
  onToggleHeatmap, onToggleClusters, onToggleHighOnly, onClearFilters, clustersSupported = false,
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
      <button onClick={onToggleHeatmap} className={btn(state.heatmap)} title="Toggle density / heatmap markers">
        <Flame className="h-3.5 w-3.5" /> Heatmap
      </button>
      <button
        onClick={onToggleClusters}
        disabled={!clustersSupported}
        className={btn(state.clusters) + (clustersSupported ? "" : " cursor-not-allowed opacity-50")}
        title={clustersSupported ? "Toggle marker clusters" : "Clustering requires Mapbox layer mode (not enabled in this build)"}
      >
        <Layers className="h-3.5 w-3.5" /> Clusters
      </button>
      <button onClick={onToggleHighOnly} className={btn(state.highOnly)} title="Show only high & critical events">
        <AlertTriangle className="h-3.5 w-3.5" /> High severity only
      </button>
      <button onClick={onClearFilters} className={btn(false)} title="Clear all filters">
        <X className="h-3.5 w-3.5" /> Clear filters
      </button>
    </div>
  );
}
