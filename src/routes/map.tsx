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

  const mapRef = useRef<ProfessionalWorldMapHandle>(null);

  async function refresh() {
    setLoading(true);
    try {
      const e = await collectMapEvents();
      setEvents(e);
      setUpdated(new Date());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load map data");
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

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
  }

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
        onResetView={() => mapRef.current?.resetView()}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        onToggleSidePanel={() => setSidePanel((v) => !v)}
        onToggleHeatmap={() => setHeatmap((v) => !v)}
        onToggleClusters={() => toast.message("Clustering will arrive in a future Mapbox layer build.")}
        onToggleHighOnly={() => setHighOnly((v) => !v)}
        onClearFilters={clearFilters}
        clustersSupported={false}
      />

      <MapSearchBox value={search} onChange={setSearch} />

      <MapFilters
        layers={layers}
        onToggleLayer={(k) => setLayers((s) => ({ ...s, [k]: !s[k] }))}
        severity={severity} onSeverity={setSeverity}
        category={category} onCategory={setCategory}
      />

      <div className={`grid gap-3 ${sidePanel ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
        <ProfessionalWorldMap ref={mapRef} events={filtered} heatmap={heatmap} height={fullscreen ? "calc(100vh - 360px)" : "70vh"} />
        {sidePanel && (
          <MapSidePanel
            events={filtered.slice(0, 100)}
            onLocate={locate}
            onSave={saveAlert}
          />
        )}
      </div>

      <MapLegend />

      {import.meta.env.DEV && (
        <div className="glass-card border-dashed p-2 text-[11px] text-muted-foreground">
          Map debug — visible: <span className="text-foreground">{filtered.length}</span> ·
          severity: <span className="text-foreground">{severity}</span> ·
          category: <span className="text-foreground">{category}</span> ·
          layers: <span className="text-foreground">{Object.entries(layers).filter(([, v]) => v).map(([k]) => k).join(", ")}</span>
        </div>
      )}
    </div>
  );
}
