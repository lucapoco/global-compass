import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfessionalWorldMap, type ProfessionalWorldMapHandle } from "@/components/map/ProfessionalWorldMap";
import { MapFilters, type LayerKey, type SeverityKey } from "@/components/map/MapFilters";
import { MapLegend } from "@/components/map/MapLegend";
import { MapToolbar } from "@/components/map/MapToolbar";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import { MapSearchBox } from "@/components/map/MapSearchBox";
import { MapCategoryFilters } from "@/components/map/MapCategoryFilters";
import { ActiveFilterSummary } from "@/components/map/ActiveFilterSummary";
import { DataBadge } from "@/components/ui/DataBadge";
import { collectMapEvents } from "@/services/mapDataService";
import { getAllCountries } from "@/services/countriesApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { filterMapEvents, categoryCounts, type EventCategory } from "@/utils/filterEvents";
import { useViewMode } from "@/context/ViewModeContext";
import type { MapEvent } from "@/types";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live World Map — Global Pulse" }] }),
  component: MapPage,
});

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  earthquake: true, intelligence: true, alert: true, weather: true, country: true,
};

const HINT_KEY = "global_pulse_map_hint_dismissed";

// Simple-mode dropdown groups -> EventCategory[]
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

  const [events, setEvents] = useState<MapEvent[]>([]);
  const [updated, setUpdated] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [severity, setSeverity] = useState<SeverityKey>("all");
  const [categories, setCategories] = useState<Set<EventCategory>>(new Set());
  const [highOnly, setHighOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [simpleGroup, setSimpleGroup] = useState("all");

  const [fullscreen, setFullscreen] = useState(false);
  const [sidePanel, setSidePanel] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [details, setDetails] = useState<MapEvent | null>(null);

  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    try { setHintDismissed(localStorage.getItem(HINT_KEY) === "1"); } catch {}
  }, []);
  function dismissHint() {
    setHintDismissed(true);
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
  }

  const mapRef = useRef<ProfessionalWorldMapHandle>(null);

  async function refresh() {
    setLoading(true);
    try {
      const e = await collectMapEvents();
      setEvents(e);
      setUpdated(new Date());
      toast.success(`Map refreshed · ${e.length} events`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load map data");
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (details) setDetails(null);
        else if (fullscreen) setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [details, fullscreen]);

  // Sync simple-mode group -> categories set
  useEffect(() => {
    if (!isSimple) return;
    const g = SIMPLE_GROUPS.find((x) => x.value === simpleGroup);
    setCategories(new Set(g?.cats ?? []));
  }, [simpleGroup, isSimple]);

  const filtered = useMemo(
    () => filterMapEvents(events, { search, layers, severity, highSeverityOnly: highOnly, categories }),
    [events, search, layers, severity, highOnly, categories],
  );

  const counts = useMemo(() => {
    // Counts based on everything except the category filter, so chips show how many would appear.
    const base = filterMapEvents(events, { search, layers, severity, highSeverityOnly: highOnly, categories: new Set() });
    return categoryCounts(base);
  }, [events, search, layers, severity, highOnly]);

  // If search exactly matches a country, fly there
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllCountries();
        const found = all.find((c) => c.name.common.toLowerCase() === q.toLowerCase());
        if (!cancelled && found?.latlng?.length === 2) {
          mapRef.current?.flyTo(found.latlng[1], found.latlng[0], 4);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [search]);

  function locate(e: MapEvent) {
    mapRef.current?.flyTo(e.lng, e.lat, 5);
  }

  async function saveAlert(e: MapEvent) {
    if (!isSupabaseConfigured()) { toast.error("Backend not configured."); return; }
    try {
      await supabaseService.saveAlert({
        title: e.title,
        type: e.type,
        severity: e.severity ?? "Low",
        location: `${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}`,
        description: e.description ?? null,
        source: "map",
      });
      toast.success("Saved alert.");
    } catch (err: any) { toast.error(err?.message ?? "Save failed"); }
  }

  function clearFilters() {
    setLayers(DEFAULT_LAYERS);
    setSeverity("all");
    setCategories(new Set());
    setHighOnly(false);
    setSearch("");
    setSimpleGroup("all");
    toast.success("Filters cleared");
  }

  function pickSeverity(s: SeverityKey) {
    setSeverity(s);
    if (s !== "all" && highOnly) setHighOnly(false);
  }

  function toggleCategory(c: EventCategory) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  function clearCategories() {
    setCategories(new Set());
    setSimpleGroup("all");
  }

  function resetView() {
    mapRef.current?.resetView();
    toast.message("Map view reset");
  }

  const allLayersOff = Object.values(layers).every((v) => !v);
  const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

  return (
    <div className={`space-y-3 ${fullscreen ? "fixed inset-0 z-40 overflow-auto bg-background p-4" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live World Map · Control Center</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} of {events.length} events plotted</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdvanced && (
            <DataBadge variant="source">{hasMapbox ? "Mapbox GL" : "Mapbox · set VITE_MAPBOX_TOKEN"}</DataBadge>
          )}
          {isAdvanced && <DataBadge variant="source">USGS</DataBadge>}
          <DataBadge variant="live">Live</DataBadge>
          <DataBadge variant="neutral">Updated {updated.toLocaleTimeString()}</DataBadge>
        </div>
      </div>

      {!hintDismissed && (
        <div className="glass-card flex items-start justify-between gap-3 border-primary/30 bg-primary/5 p-3 text-xs">
          <span>
            {isSimple
              ? "You are using Simple View. Only essential controls are shown."
              : "You are using Advanced View. Use category, severity and layer filters to control the map."}
          </span>
          <button onClick={dismissHint} className="rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {isSimple ? (
        <SimpleControls
          loading={loading}
          search={search} setSearch={setSearch}
          highOnly={highOnly} setHighOnly={setHighOnly}
          simpleGroup={simpleGroup} setSimpleGroup={setSimpleGroup}
          onRefresh={refresh} onResetView={resetView}
        />
      ) : (
        <>
          <MapToolbar
            state={{ loading, fullscreen, sidePanel, heatmap, clusters: false, highOnly }}
            onRefresh={refresh}
            onResetView={resetView}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            onToggleSidePanel={() => setSidePanel((v) => !v)}
            onToggleHeatmap={() => setHeatmap((v) => !v)}
            onToggleClusters={() => toast.message("Clusters require Mapbox layer mode. Currently unavailable in fallback mode.")}
            onToggleHighOnly={() => setHighOnly((v) => !v)}
            onClearFilters={clearFilters}
            clustersSupported={false}
          />
          <MapSearchBox value={search} onChange={setSearch} />
          <MapFilters
            layers={layers}
            onToggleLayer={(k) => setLayers((s) => ({ ...s, [k]: !s[k] }))}
            severity={severity} onSeverity={pickSeverity}
          />
          <MapCategoryFilters
            selected={categories}
            counts={counts}
            onToggle={toggleCategory}
            onClear={clearCategories}
          />
          <ActiveFilterSummary
            categories={categories}
            severity={severity}
            highOnly={highOnly}
            search={search}
            onRemoveCategory={toggleCategory}
            onClearSeverity={() => setSeverity("all")}
            onClearHighOnly={() => setHighOnly(false)}
            onClearSearch={() => setSearch("")}
            onClearAll={clearFilters}
          />
        </>
      )}

      {allLayersOff && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          All layers are disabled. <button onClick={clearFilters} className="text-primary underline-offset-2 hover:underline">Clear filters</button> to restore.
        </div>
      )}

      {filtered.length === 0 && !allLayersOff && categories.size > 0 && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          No events found for selected categories.{" "}
          <button onClick={clearCategories} className="text-primary underline-offset-2 hover:underline">Clear category filters</button>
        </div>
      )}

      <div className={`grid gap-3 ${(!isSimple && sidePanel) ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
        <ProfessionalWorldMap ref={mapRef} events={filtered} heatmap={heatmap} height={fullscreen ? "calc(100vh - 360px)" : "70vh"} />
        {(isSimple || sidePanel) && (
          <MapSidePanel
            events={filtered.slice(0, 100)}
            onLocate={locate}
            onSave={isSimple ? undefined : saveAlert}
            onDetails={(e) => setDetails(e)}
          />
        )}
      </div>

      <MapLegend />

      {details && <MapEventDetailsModal event={details} onClose={() => setDetails(null)} onLocate={locate} onSave={saveAlert} />}
    </div>
  );
}

function SimpleControls({
  loading, search, setSearch, highOnly, setHighOnly,
  simpleGroup, setSimpleGroup, onRefresh, onResetView,
}: {
  loading: boolean;
  search: string; setSearch: (s: string) => void;
  highOnly: boolean; setHighOnly: (b: boolean) => void;
  simpleGroup: string; setSimpleGroup: (v: string) => void;
  onRefresh: () => void; onResetView: () => void;
}) {
  return (
    <div className="glass-card grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search events, places, topics…"
        className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
      />
      <select
        value={simpleGroup}
        onChange={(e) => setSimpleGroup(e.target.value)}
        className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
      >
        {SIMPLE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
      <button
        onClick={() => setHighOnly(!highOnly)}
        className={`rounded-md border px-3 py-2 text-xs ${highOnly ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}
      >
        {highOnly ? "Important only" : "All events"}
      </button>
      <button onClick={onRefresh} disabled={loading} className="rounded-md border border-border/60 px-3 py-2 text-xs disabled:opacity-50">
        {loading ? "Refreshing…" : "Refresh"}
      </button>
      <button onClick={onResetView} className="rounded-md border border-border/60 px-3 py-2 text-xs">Reset view</button>
    </div>
  );
}

function MapEventDetailsModal({ event, onClose, onLocate, onSave }: { event: MapEvent; onClose: () => void; onLocate: (e: MapEvent) => void; onSave: (e: MapEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card relative max-h-[85vh] w-full max-w-lg overflow-auto p-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{event.type}</span>
          {event.severity && <span>· {event.severity}</span>}
          {event.category && <span>· {event.category}</span>}
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug">{event.title}</h2>
        {event.description && <p className="mt-2 text-sm text-foreground/90">{event.description}</p>}
        <div className="mt-3 text-[11px] text-muted-foreground">Coordinates: {event.lat.toFixed(3)}, {event.lng.toFixed(3)}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => { onLocate(event); onClose(); }} className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary">Locate on map</button>
          {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">Open source</a>}
          <button onClick={() => onSave(event)} className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary">Save alert</button>
          <button onClick={onClose} className="ml-auto rounded-md border border-border/60 px-3 py-1.5 text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}
