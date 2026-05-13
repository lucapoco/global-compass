import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfessionalWorldMap, type ProfessionalWorldMapHandle } from "@/components/map/ProfessionalWorldMap";
import { MapFilters, type LayerKey, type SeverityKey, type CategoryKey } from "@/components/map/MapFilters";
import { MapLegend } from "@/components/map/MapLegend";
import { MapToolbar } from "@/components/map/MapToolbar";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import { MapSearchBox } from "@/components/map/MapSearchBox";
import { DataBadge } from "@/components/ui/DataBadge";
import { collectMapEvents } from "@/services/mapDataService";
import { getAllCountries } from "@/services/countriesApi";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import type { MapEvent } from "@/types";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live World Map — Global Pulse" }] }),
  component: MapPage,
});

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  earthquake: true, intelligence: true, alert: true, weather: true, country: true,
};

function MapPage() {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [updated, setUpdated] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [severity, setSeverity] = useState<SeverityKey>("all");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [highOnly, setHighOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [fullscreen, setFullscreen] = useState(false);
  const [sidePanel, setSidePanel] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [details, setDetails] = useState<MapEvent | null>(null);

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

  // ESC closes details / fullscreen
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!layers[e.type]) return false;
      if (highOnly && !["High", "Critical"].includes(e.severity ?? "")) return false;
      if (severity !== "all" && e.severity !== severity) return false;
      if (category !== "all") {
        if (category === "earthquake" && e.type !== "earthquake") return false;
        else if (category === "weather" && e.type !== "weather") return false;
        else if (category !== "earthquake" && category !== "weather") {
          if (e.category !== category) return false;
        }
      }
      if (q) {
        const blob = `${e.title} ${e.description ?? ""} ${e.category ?? ""} ${e.type}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [events, layers, severity, category, highOnly, search]);

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
    setCategory("all");
    setHighOnly(false);
    setSearch("");
    toast.success("Filters cleared");
  }

  function pickSeverity(s: SeverityKey) {
    setSeverity(s);
    if (s !== "all" && highOnly) setHighOnly(false);
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
          <DataBadge variant="source">{hasMapbox ? "Mapbox GL" : "MapLibre fallback"}</DataBadge>
          <DataBadge variant="source">USGS</DataBadge>
          <DataBadge variant="live">Live</DataBadge>
          <DataBadge variant="neutral">Updated {updated.toLocaleTimeString()}</DataBadge>
        </div>
      </div>

      <MapToolbar
        state={{ loading, fullscreen, sidePanel, heatmap, clusters: false, highOnly }}
        onRefresh={refresh}
        onResetView={resetView}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        onToggleSidePanel={() => setSidePanel((v) => !v)}
        onToggleHeatmap={() => { setHeatmap((v) => !v); }}
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
        category={category} onCategory={setCategory}
      />

      {allLayersOff && (
        <div className="glass-card border-dashed p-3 text-center text-xs text-muted-foreground">
          All layers are disabled. <button onClick={clearFilters} className="text-primary underline-offset-2 hover:underline">Clear filters</button> to restore.
        </div>
      )}

      <div className={`grid gap-3 ${sidePanel ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
        <ProfessionalWorldMap ref={mapRef} events={filtered} heatmap={heatmap} height={fullscreen ? "calc(100vh - 360px)" : "70vh"} />
        {sidePanel && (
          <MapSidePanel
            events={filtered.slice(0, 100)}
            onLocate={locate}
            onSave={saveAlert}
            onDetails={(e) => setDetails(e)}
          />
        )}
      </div>

      <MapLegend />

      {details && <MapEventDetailsModal event={details} onClose={() => setDetails(null)} onLocate={locate} onSave={saveAlert} />}
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
