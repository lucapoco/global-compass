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
import { DataBadge } from "@/components/ui/DataBadge";
import { collectGlobalMapEvents } from "@/services/mapDataService";
import { getAllCountries } from "@/services/countriesApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { filterGlobalEvents, categoryCountsFromGlobal, DEFAULT_ENABLED_LAYERS } from "@/utils/filterEvents";
import { useViewMode } from "@/context/ViewModeContext";
import type { EventCategory, EventLayer, EventSeverity, GlobalEvent } from "@/types";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live World Map — Global Pulse" }] }),
  component: MapPage,
});

const HINT_KEY = "global_pulse_map_hint_dismissed";

const SIMPLE_GROUPS: { value: string; label: string; cats: EventCategory[] }[] = [
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

  const [allEvents, setAllEvents] = useState<GlobalEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledLayers, setEnabledLayers] = useState<EventLayer[]>([...DEFAULT_ENABLED_LAYERS]);
  const [selectedSeverity, setSelectedSeverity] = useState<EventSeverity | "all">("all");
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([]);
  const [highSeverityOnly, setHighSeverityOnly] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GlobalEvent | null>(null);
  const [details, setDetails] = useState<GlobalEvent | null>(null);
  const [simpleGroup, setSimpleGroup] = useState("all");

  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    try {
      setHintDismissed(localStorage.getItem(HINT_KEY) === "1");
    } catch {}
  }, []);

  const mapRef = useRef<ProfessionalWorldMapHandle>(null);

  const visibleEvents = useMemo(
    () =>
      filterGlobalEvents(allEvents, {
        searchQuery,
        enabledLayers,
        selectedSeverity,
        selectedCategories,
        highSeverityOnly,
      }),
    [allEvents, searchQuery, enabledLayers, selectedSeverity, selectedCategories, highSeverityOnly],
  );

  const markerEvents = useMemo(
    () => visibleEvents.filter((e) => e.latitude != null && e.longitude != null),
    [visibleEvents],
  );

  const categoryCounts = useMemo(() => {
    const base = filterGlobalEvents(allEvents, {
      searchQuery,
      enabledLayers,
      selectedSeverity,
      selectedCategories: [],
      highSeverityOnly,
    });
    return categoryCountsFromGlobal(base);
  }, [allEvents, searchQuery, enabledLayers, selectedSeverity, highSeverityOnly]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const e = await collectGlobalMapEvents();
      setAllEvents(e);
      setLastUpdated(new Date());
      toast.success("Map data refreshed");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load map data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (details) setDetails(null);
        else if (fullscreenMode) setFullscreenMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [details, fullscreenMode]);

  useEffect(() => {
    if (!isSimple) return;
    const g = SIMPLE_GROUPS.find((x) => x.value === simpleGroup);
    setSelectedCategories([...(g?.cats ?? [])]);
  }, [simpleGroup, isSimple]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) return;
    let cancelled = false;
    void (async () => {
      try {
        const all = await getAllCountries();
        const found = all.find((c) => c.name.common.toLowerCase() === q.toLowerCase());
        if (!cancelled && found?.latlng?.length === 2) {
          mapRef.current?.flyTo(found.latlng[1], found.latlng[0], 4);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const onMarkerSelect = useCallback((e: GlobalEvent) => {
    setSelectedEvent(e);
  }, []);

  function locate(e: GlobalEvent) {
    if (e.latitude == null || e.longitude == null) {
      toast.error("This event has no coordinates.");
      return;
    }
    setSelectedEvent(e);
    mapRef.current?.flyTo(e.longitude, e.latitude, 5);
  }

  async function saveEvent(e: GlobalEvent) {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (e.latitude == null || e.longitude == null) {
      toast.error("Cannot save without coordinates.");
      return;
    }
    try {
      await supabaseService.saveAlert({
        title: e.title,
        type: e.layer,
        severity: (e.severity.charAt(0).toUpperCase() + e.severity.slice(1)) as import("@/types").Severity,
        location: `${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)}`,
        description: e.description ?? null,
        source: (e.source ?? "map").slice(0, 80),
      });
      toast.success("Event saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    }
  }

  function clearFilters() {
    setEnabledLayers([...DEFAULT_ENABLED_LAYERS]);
    setSelectedSeverity("all");
    setSelectedCategories([]);
    setHighSeverityOnly(false);
    setSearchQuery("");
    setSimpleGroup("all");
    setSelectedEvent(null);
    setDetails(null);
    toast.success("Filters cleared");
  }

  function pickSeverity(s: EventSeverity | "all") {
    setSelectedSeverity(s);
    if (s !== "all") setHighSeverityOnly(false);
  }

  function toggleHighOnly() {
    setHighSeverityOnly((v) => {
      const next = !v;
      if (next) setSelectedSeverity("all");
      return next;
    });
  }

  function toggleCategory(c: EventCategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return [...next];
    });
  }

  function clearCategories() {
    setSelectedCategories([]);
    setSimpleGroup("all");
  }

  function toggleLayer(k: EventLayer) {
    setEnabledLayers((prev) => {
      if (prev.includes(k)) return prev.filter((x) => x !== k);
      return [...prev, k];
    });
  }

  function enableAllLayers() {
    setEnabledLayers([...DEFAULT_ENABLED_LAYERS]);
    toast.message("All layers enabled");
  }

  function resetView() {
    setSelectedEvent(null);
    setDetails(null);
    mapRef.current?.resetView();
    toast.success("Map view reset");
  }

  function dismissHint() {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  }

  const allLayersOff = enabledLayers.length === 0;
  const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
  const clustersSupported = false;

  const highVisibleCount = useMemo(
    () => visibleEvents.filter((e) => e.severity === "high" || e.severity === "critical").length,
    [visibleEvents],
  );

  return (
    <div className={`space-y-3 ${fullscreenMode ? "fixed inset-0 z-40 overflow-auto bg-background p-4" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live World Map · Control Center</h1>
          <p className="text-xs text-muted-foreground">
            {visibleEvents.length} of {allEvents.length} events visible
            {error ? <span className="ml-2 text-rose-500">· {error}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdvanced && (
            <DataBadge variant="source">{hasMapbox ? "Mapbox GL" : "Mapbox · set VITE_MAPBOX_TOKEN"}</DataBadge>
          )}
          <DataBadge variant="source">USGS</DataBadge>
          <DataBadge variant="source">GNews proxy</DataBadge>
          <DataBadge variant="source">REST Countries</DataBadge>
          {isSupabaseConfigured() ? <DataBadge variant="source">Supabase</DataBadge> : <DataBadge variant="neutral">Supabase off</DataBadge>}
          <DataBadge variant="demo">Demo weather</DataBadge>
          {lastUpdated && <DataBadge variant="neutral">Updated {lastUpdated.toLocaleTimeString()}</DataBadge>}
        </div>
      </div>

      {!hintDismissed && (
        <div className="glass-card flex items-start justify-between gap-3 border-primary/30 bg-primary/5 p-3 text-xs">
          <span>
            {isSimple
              ? "You are using Simple View. Only essential controls are shown."
              : "You are using Advanced View. Use category, severity and layer filters to control the map."}
          </span>
          <button
            type="button"
            onClick={dismissHint}
            className="rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {isSimple ? (
        <SimpleControls
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          highSeverityOnly={highSeverityOnly}
          onToggleHighOnly={toggleHighOnly}
          simpleGroup={simpleGroup}
          setSimpleGroup={setSimpleGroup}
          onRefresh={() => void refresh()}
          onResetView={resetView}
        />
      ) : (
        <>
          <MapToolbar
            state={{
              loading,
              fullscreen: fullscreenMode,
              sidePanel: sidePanelOpen,
              heatmap: heatmapEnabled,
              clusters: false,
              highOnly: highSeverityOnly,
            }}
            onRefresh={() => void refresh()}
            onResetView={resetView}
            onToggleFullscreen={() => setFullscreenMode((v) => !v)}
            onToggleSidePanel={() => setSidePanelOpen((v) => !v)}
            onToggleHeatmap={() => setHeatmapEnabled((v) => !v)}
            onToggleClusters={() => {
              /* clusters toggle reserved for Mapbox cluster layer mode */
            }}
            onToggleHighOnly={toggleHighOnly}
            onClearFilters={clearFilters}
            clustersSupported={clustersSupported}
          />
          <MapSearchBox value={searchQuery} onChange={setSearchQuery} />
          <MapFilters
            enabledLayers={enabledLayers}
            onToggleLayer={toggleLayer}
            selectedSeverity={selectedSeverity}
            onSeverity={pickSeverity}
          />
          <MapCategoryFilters
            selected={new Set(selectedCategories)}
            counts={categoryCounts}
            onToggle={toggleCategory}
            onClear={clearCategories}
          />
          <ActiveFilterSummary
            categories={new Set(selectedCategories)}
            selectedSeverity={selectedSeverity}
            highOnly={highSeverityOnly}
            searchQuery={searchQuery}
            enabledLayers={enabledLayers}
            onRemoveCategory={toggleCategory}
            onClearSeverity={() => setSelectedSeverity("all")}
            onClearHighOnly={() => setHighSeverityOnly(false)}
            onClearSearch={() => setSearchQuery("")}
            onEnableLayer={(l) => setEnabledLayers((prev) => (prev.includes(l) ? prev : [...prev, l]))}
            onClearAll={clearFilters}
          />
        </>
      )}

      {isAdvanced && highSeverityOnly && (
        <p className="text-[10px] text-muted-foreground">High / critical in view: {highVisibleCount}</p>
      )}

      {allLayersOff && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          All layers are disabled.{" "}
          <button type="button" onClick={enableAllLayers} className="text-primary underline-offset-2 hover:underline">
            Enable all layers
          </button>
        </div>
      )}

      {!allLayersOff &&
        visibleEvents.length === 0 &&
        selectedCategories.length > 0 &&
        !searchQuery.trim() && (
          <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
            No events found for selected categories.{" "}
            <button type="button" onClick={clearCategories} className="text-primary underline-offset-2 hover:underline">
              Clear category filters
            </button>
          </div>
        )}

      {!allLayersOff && visibleEvents.length === 0 && searchQuery.trim() && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          No map events found for this search.{" "}
          <button type="button" onClick={() => setSearchQuery("")} className="text-primary underline-offset-2 hover:underline">
            Clear search
          </button>
        </div>
      )}

      <div
        className={`grid gap-3 ${
          sidePanelOpen ? "max-lg:grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"
        } max-lg:gap-2`}
      >
        <div className="relative min-h-[50vh]">
          {loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 backdrop-blur-[1px]">
              <div className="rounded-md border border-border/60 bg-card/90 px-4 py-2 text-xs text-muted-foreground">
                Loading map data…
              </div>
            </div>
          )}
          <ProfessionalWorldMap
            ref={mapRef}
            events={markerEvents}
            heatmap={heatmapEnabled}
            selectedEventId={selectedEvent?.id ?? null}
            onMarkerSelect={onMarkerSelect}
            height={fullscreenMode ? "calc(100vh - 360px)" : "70vh"}
          />
        </div>
        {(isSimple || sidePanelOpen) && (
          <div className="max-lg:max-h-[45vh] max-lg:overflow-hidden lg:min-h-0">
            <MapSidePanel
              events={visibleEvents.slice(0, 200)}
              selectedId={selectedEvent?.id ?? null}
              onLocate={locate}
              onSave={saveEvent}
              onDetails={(e) => setDetails(e)}
            />
          </div>
        )}
      </div>

      <MapLegend />

      {details && (
        <MapEventDetailsModal
          event={details}
          onClose={() => setDetails(null)}
          onLocate={locate}
          onSave={saveEvent}
        />
      )}
    </div>
  );
}

function SimpleControls({
  loading,
  searchQuery,
  setSearchQuery,
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
  highSeverityOnly: boolean;
  onToggleHighOnly: () => void;
  simpleGroup: string;
  setSimpleGroup: (v: string) => void;
  onRefresh: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="glass-card grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
      <MapSearchBox value={searchQuery} onChange={setSearchQuery} />
      <select
        value={simpleGroup}
        onChange={(e) => setSimpleGroup(e.target.value)}
        className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
      >
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
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-md border border-border/60 px-3 py-2 text-xs disabled:opacity-50"
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      <button type="button" onClick={onResetView} className="rounded-md border border-border/60 px-3 py-2 text-xs">
        Reset view
      </button>
    </div>
  );
}

function MapEventDetailsModal({
  event,
  onClose,
  onLocate,
  onSave,
}: {
  event: GlobalEvent;
  onClose: () => void;
  onLocate: (e: GlobalEvent) => void;
  onSave: (e: GlobalEvent) => void;
}) {
  const hasCoords = event.latitude != null && event.longitude != null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card relative max-h-[85vh] w-full max-w-lg overflow-auto p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{event.layer}</span>
          <span>· {event.severity}</span>
          <span>· {event.category}</span>
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug">{event.title}</h2>
        {event.description && <p className="mt-2 text-sm text-foreground/90">{event.description}</p>}
        <div className="mt-2 text-[11px] text-muted-foreground">
          {event.source}
          {event.country ? ` · ${event.country}` : ""}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">{new Date(event.publishedAt).toLocaleString()}</div>
        {hasCoords ? (
          <div className="mt-3 text-[11px] text-muted-foreground">
            Coordinates: {event.latitude!.toFixed(3)}, {event.longitude!.toFixed(3)}
          </div>
        ) : (
          <div className="mt-3 text-[11px] text-amber-600">No coordinates for this event.</div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onLocate(event);
              onClose();
            }}
            disabled={!hasCoords}
            title={hasCoords ? "" : "This event has no coordinates."}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Locate on map
          </button>
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"
            >
              Open source
            </a>
          ) : (
            <span
              title="No source URL available"
              className="cursor-not-allowed rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground opacity-50"
            >
              Open source
            </span>
          )}
          <button type="button" onClick={() => onSave(event)} className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary">
            Save
          </button>
          <button type="button" onClick={onClose} className="ml-auto rounded-md border border-border/60 px-3 py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
