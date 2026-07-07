import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfessionalWorldMap, type ProfessionalWorldMapHandle } from "@/components/map/ProfessionalWorldMap";
import { MapFilters } from "@/components/map/MapFilters";
import { MapLegend } from "@/components/map/MapLegend";
import { MapToolbar } from "@/components/map/MapToolbar";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import { MapSearchBox } from "@/components/map/MapSearchBox";
import { MapCategoryFilters } from "@/components/map/MapCategoryFilters";
import { ActiveFilterSummary } from "@/components/map/ActiveFilterSummary";
import { MapTimeline } from "@/components/map/MapTimeline";
import { MapReplayControls } from "@/components/map/MapReplayControls";
import { MapStatusPanel } from "@/components/map/MapStatusPanel";
import { MapEventDetailsPanel } from "@/components/map/MapEventDetailsPanel";
import { MapCountryInsightPanel } from "@/components/map/MapCountryInsightPanel";
import { DataBadge } from "@/components/ui/DataBadge";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { useMapEngine } from "@/hooks/useMapEngine";
import { useReplay } from "@/hooks/useReplay";
import { clusterEvents } from "@/domain/services/map-engine/clustering/clusterEvents";
import { buildHeatmapGeoJSON } from "@/domain/services/map-engine/heatmap/heatmapData";
import { buildRelatedEventLines } from "@/domain/services/map-engine/relationships/relatedEventLines";
import { searchEvents } from "@/domain/services/event-engine/search/searchEvents";
import type { EventCluster } from "@/domain/services/map-engine";
import type { GlobalEvent, GlobalEventCategory } from "@/domain/models/GlobalEvent";
import type { Severity } from "@/types";
import { useViewMode } from "@/context/ViewModeContext";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live World Map — Global Pulse" }] }),
  component: MapPage,
});

const HINT_KEY = "global_pulse_map_hint_dismissed";

const SIMPLE_GROUPS: { value: string; label: string; cats: GlobalEventCategory[] }[] = [
  { value: "all", label: "All events", cats: [] },
  { value: "news", label: "News", cats: ["geopolitics", "general", "technology", "health", "energy", "climate"] },
  { value: "earthquake", label: "Earthquakes", cats: ["earthquake"] },
  { value: "weather", label: "Weather", cats: ["weather"] },
  { value: "cyber", label: "Cyber", cats: ["cyber"] },
  { value: "economy", label: "Economy", cats: ["economy"] },
  { value: "military", label: "Military", cats: ["military"] },
  { value: "disasters", label: "Disasters", cats: ["disaster"] },
];

function MapPage() {
  const { isSimple, isAdvanced } = useViewMode();
  const engine = useMapEngine();
  const replay = useReplay(engine.filteredEvents, engine.replayActive);

  const visibleEvents = engine.replayActive ? replay.visibleEvents : engine.filteredEvents;

  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [countryPanel, setCountryPanel] = useState<GlobalEvent | null>(null);
  const [simpleGroup, setSimpleGroup] = useState("all");

  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    try {
      setHintDismissed(localStorage.getItem(HINT_KEY) === "1");
    } catch {}
  }, []);

  const mapRef = useRef<ProfessionalWorldMapHandle>(null);

  const clusters: EventCluster[] = useMemo(
    () => clusterEvents(visibleEvents, engine.viewport.zoom),
    [visibleEvents, engine.viewport.zoom],
  );

  const heatmapData = useMemo(
    () => buildHeatmapGeoJSON(visibleEvents, engine.heatmapWeightMode),
    [visibleEvents, engine.heatmapWeightMode],
  );

  const relationLines = useMemo(
    () => (engine.selectedEventId ? buildRelatedEventLines(engine.allEvents, engine.selectedEventId) : { type: "FeatureCollection" as const, features: [] }),
    [engine.allEvents, engine.selectedEventId],
  );

  const searchResults = useMemo(
    () => (engine.filterState.searchQuery.trim() ? searchEvents(engine.allEvents, engine.filterState.searchQuery) : []),
    [engine.allEvents, engine.filterState.searchQuery],
  );

  useEffect(() => {
    if (!isSimple) return;
    const g = SIMPLE_GROUPS.find((x) => x.value === simpleGroup);
    engine.setCategories([...(g?.cats ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simpleGroup, isSimple]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (countryPanel) setCountryPanel(null);
        else if (engine.selectedEventId) engine.select(null);
        else if (fullscreenMode) setFullscreenMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryPanel, engine.selectedEventId, fullscreenMode]);

  const onSelectEvent = useCallback(
    (e: GlobalEvent) => {
      if (e.category === "country") {
        setCountryPanel(e);
        engine.select(null);
      } else {
        setCountryPanel(null);
        engine.select(e.id);
      }
    },
    [engine],
  );

  const onExpandCluster = useCallback(
    (cluster: EventCluster) => {
      mapRef.current?.flyTo(cluster.lng, cluster.lat, Math.min(12, engine.viewport.zoom + 2.5));
    },
    [engine.viewport.zoom],
  );

  function locate(e: GlobalEvent) {
    if (!e.coordinates) {
      toast.error("This event has no coordinates.");
      return;
    }
    onSelectEvent(e);
    mapRef.current?.flyTo(e.coordinates.lng, e.coordinates.lat, 5);
  }

  function onSelectSearchResult(e: GlobalEvent) {
    engine.setSearchQuery("");
    if (e.coordinates) mapRef.current?.flyTo(e.coordinates.lng, e.coordinates.lat, 5);
    onSelectEvent(e);
  }

  async function saveEvent(e: GlobalEvent) {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (!e.coordinates) {
      toast.error("Cannot save without coordinates.");
      return;
    }
    try {
      await supabaseService.saveAlert({
        title: e.title,
        type: e.category,
        severity: (e.severity.charAt(0).toUpperCase() + e.severity.slice(1)) as Severity,
        location: `${e.coordinates.lat.toFixed(3)}, ${e.coordinates.lng.toFixed(3)}`,
        description: e.description ?? null,
        source: (e.source ?? "map").slice(0, 80),
      });
      toast.success("Event saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  function clearFilters() {
    engine.clearFilters();
    setSimpleGroup("all");
    setCountryPanel(null);
  }

  function resetView() {
    engine.resetView();
    setCountryPanel(null);
    mapRef.current?.resetView();
    toast.success("Map view reset");
  }

  function dismissHint() {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  }

  const allLayersOff = engine.enabledLayerGroups.length === 0;
  const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
  const selectedCategories = new Set(engine.filterState.categories ?? []);
  const selectedSeverities = engine.filterState.severities ?? [];

  return (
    <div className={`space-y-3 ${fullscreenMode ? "fixed inset-0 z-40 overflow-auto bg-background p-4" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live World Map · Global Intelligence Control Center</h1>
          <p className="text-xs text-muted-foreground">
            {visibleEvents.length} of {engine.allEvents.length} events visible
            {engine.error ? <span className="ml-2 text-rose-500">· {engine.error}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdvanced && <DataBadge variant="source">{hasMapbox ? "Mapbox GL" : "Mapbox · set VITE_MAPBOX_TOKEN"}</DataBadge>}
          <DataBadge variant="source">EventEngine</DataBadge>
          <DataBadge variant="source">USGS</DataBadge>
          <DataBadge variant="source">GNews proxy</DataBadge>
          <DataBadge variant="source">REST Countries</DataBadge>
          {isSupabaseConfigured() ? <DataBadge variant="source">Supabase</DataBadge> : <DataBadge variant="neutral">Supabase off</DataBadge>}
          <DataBadge variant="demo">Demo weather</DataBadge>
        </div>
      </div>

      {!hintDismissed && (
        <div className="glass-card flex items-start justify-between gap-3 border-primary/30 bg-primary/5 p-3 text-xs">
          <span>
            {isSimple
              ? "You are using Simple View. Only essential controls are shown."
              : "You are using Advanced View. Every category, severity, risk, provider and timeline filter is wired to the shared EventEngine."}
          </span>
          <button type="button" onClick={dismissHint} className="rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      <MapStatusPanel
        totalEvents={engine.allEvents.length}
        visibleEvents={visibleEvents.length}
        providerStatus={engine.providerStatus}
        lastUpdated={engine.lastUpdated}
      />

      {isSimple ? (
        <SimpleControls
          loading={engine.loading}
          searchQuery={engine.filterState.searchQuery}
          setSearchQuery={engine.setSearchQuery}
          searchResults={searchResults}
          onSelectResult={onSelectSearchResult}
          highSeverityOnly={selectedSeverities.includes("high") && selectedSeverities.includes("critical")}
          onToggleHighOnly={() => engine.setSeverities(selectedSeverities.length ? [] : ["high", "critical"])}
          simpleGroup={simpleGroup}
          setSimpleGroup={setSimpleGroup}
          onRefresh={() => void engine.refresh(true)}
          onResetView={resetView}
        />
      ) : (
        <>
          <MapToolbar
            state={{
              loading: engine.loading,
              fullscreen: fullscreenMode,
              sidePanel: sidePanelOpen,
              visualizationMode: engine.visualizationMode,
              replayActive: engine.replayActive,
            }}
            onRefresh={() => void engine.refresh(true)}
            onResetView={resetView}
            onToggleFullscreen={() => setFullscreenMode((v) => !v)}
            onToggleSidePanel={() => setSidePanelOpen((v) => !v)}
            onSetVisualizationMode={engine.setVisualizationMode}
            onToggleReplay={() => engine.setReplayActive((v) => !v)}
            onClearFilters={clearFilters}
          />
          <MapTimeline value={engine.timeline} onChange={engine.setTimeline} />
          {engine.replayActive && <MapReplayControls replay={replay} />}
          <MapSearchBox
            value={engine.filterState.searchQuery}
            onChange={engine.setSearchQuery}
            results={searchResults}
            onSelectResult={onSelectSearchResult}
          />
          <MapFilters
            enabledLayerGroups={engine.enabledLayerGroups}
            onToggleLayerGroup={engine.toggleLayerGroup}
            selectedSeverities={selectedSeverities}
            onToggleSeverity={engine.toggleSeverity}
            minRiskScore={engine.filterState.minRiskScore}
            onMinRiskScore={engine.setMinRiskScore}
            minConfidence={engine.filterState.minConfidence}
            onMinConfidence={engine.setMinConfidence}
            verifiedOnly={Boolean(engine.filterState.verifiedOnly)}
            onToggleVerifiedOnly={engine.toggleVerifiedOnly}
            liveOnly={Boolean(engine.filterState.liveOnly)}
            onToggleLiveOnly={engine.toggleLiveOnly}
          />
          <MapCategoryFilters
            selected={selectedCategories}
            counts={engine.categoryCounts}
            onToggle={engine.toggleCategory}
            onClear={() => engine.setCategories([])}
          />
          <ActiveFilterSummary
            categories={selectedCategories}
            severities={selectedSeverities}
            searchQuery={engine.filterState.searchQuery}
            enabledLayerGroups={engine.enabledLayerGroups}
            minRiskScore={engine.filterState.minRiskScore}
            minConfidence={engine.filterState.minConfidence}
            verifiedOnly={Boolean(engine.filterState.verifiedOnly)}
            liveOnly={Boolean(engine.filterState.liveOnly)}
            onRemoveCategory={engine.toggleCategory}
            onRemoveSeverity={engine.toggleSeverity}
            onClearSearch={() => engine.setSearchQuery("")}
            onEnableLayerGroup={engine.toggleLayerGroup}
            onClearRisk={() => engine.setMinRiskScore(undefined)}
            onClearConfidence={() => engine.setMinConfidence(undefined)}
            onClearVerified={engine.toggleVerifiedOnly}
            onClearLive={engine.toggleLiveOnly}
            onClearAll={clearFilters}
          />
        </>
      )}

      {allLayersOff && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          All layers are disabled.{" "}
          <button type="button" onClick={engine.enableAllLayerGroups} className="text-primary underline-offset-2 hover:underline">
            Enable all layers
          </button>
        </div>
      )}

      {!allLayersOff && visibleEvents.length === 0 && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          No events match the current filters / timeline.{" "}
          <button type="button" onClick={clearFilters} className="text-primary underline-offset-2 hover:underline">
            Clear filters
          </button>
        </div>
      )}

      <div className={`grid gap-3 ${sidePanelOpen ? "max-lg:grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"} max-lg:gap-2`}>
        <div className="relative min-h-[50vh]">
          {engine.loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 backdrop-blur-[1px]">
              <div className="rounded-md border border-border/60 bg-card/90 px-4 py-2 text-xs text-muted-foreground">Loading map data…</div>
            </div>
          )}
          <ProfessionalWorldMap
            ref={mapRef}
            clusters={clusters}
            visualizationMode={engine.visualizationMode}
            heatmapData={heatmapData}
            relationLines={relationLines}
            selectedEventId={engine.selectedEventId}
            onSelectEvent={onSelectEvent}
            onExpandCluster={onExpandCluster}
            onViewportChange={engine.setViewport}
            height={fullscreenMode ? "calc(100vh - 360px)" : "70vh"}
          />
        </div>
        {(isSimple || sidePanelOpen) && (
          <div className="max-lg:max-h-[45vh] max-lg:overflow-hidden lg:min-h-0">
            {engine.selectedEvent ? (
              <MapEventDetailsPanel
                event={engine.selectedEvent}
                relatedEvents={engine.relatedEvents}
                onClose={() => engine.select(null)}
                onLocate={locate}
                onSave={saveEvent}
                onSelectRelated={onSelectEvent}
              />
            ) : countryPanel ? (
              <MapCountryInsightPanel
                countryEvent={countryPanel}
                allEvents={engine.allEvents}
                onClose={() => setCountryPanel(null)}
                onSelectEvent={onSelectEvent}
              />
            ) : (
              <MapSidePanel events={visibleEvents.slice(0, 200)} selectedId={engine.selectedEventId} onLocate={locate} onSave={saveEvent} onDetails={onSelectEvent} />
            )}
          </div>
        )}
      </div>

      <MapLegend />
    </div>
  );
}

function SimpleControls({
  loading,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSelectResult,
  highSeverityOnly,
  onToggleHighOnly,
  simpleGroup,
  setSimpleGroup,
  onRefresh,
  onResetView,
}: {
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  searchResults: GlobalEvent[];
  onSelectResult: (e: GlobalEvent) => void;
  highSeverityOnly: boolean;
  onToggleHighOnly: () => void;
  simpleGroup: string;
  setSimpleGroup: (v: string) => void;
  onRefresh: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="glass-card grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
      <MapSearchBox value={searchQuery} onChange={setSearchQuery} results={searchResults} onSelectResult={onSelectResult} />
      <select value={simpleGroup} onChange={(e) => setSimpleGroup(e.target.value)} className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm">
        {SIMPLE_GROUPS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleHighOnly}
        className={`rounded-md border px-3 py-2 text-xs ${
          highSeverityOnly ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
        }`}
      >
        {highSeverityOnly ? "Important only" : "All events"}
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} className="rounded-md border border-border/60 px-3 py-2 text-xs disabled:opacity-50">
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      <button type="button" onClick={onResetView} className="rounded-md border border-border/60 px-3 py-2 text-xs">
        Reset view
      </button>
    </div>
  );
}

