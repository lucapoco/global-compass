import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ProfessionalWorldMap } from "@/components/map/ProfessionalWorldMap";
import { MapFilters, type MapFilterKey } from "@/components/map/MapFilters";
import { MapLegend } from "@/components/map/MapLegend";
import { DataBadge } from "@/components/ui/DataBadge";
import { collectMapEvents } from "@/services/mapDataService";
import type { MapEvent } from "@/types";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live World Map — Global Pulse" }] }),
  component: MapPage,
});

function MapPage() {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [updated, setUpdated] = useState(new Date());
  const [filters, setFilters] = useState<Record<MapFilterKey, boolean>>({
    earthquake: true, weather: true, country: true, alert: true, intelligence: true, highOnly: false,
  });

  useEffect(() => {
    collectMapEvents().then((e) => { setEvents(e); setUpdated(new Date()); });
  }, []);

  const filtered = useMemo(() => events.filter((e) => {
    if (!filters[e.type]) return false;
    if (filters.highOnly && !["High", "Critical"].includes(e.severity ?? "")) return false;
    return true;
  }), [events, filters]);

  const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live World Map</h1>
          <p className="text-xs text-muted-foreground">Professional dark map · {filtered.length} events plotted</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataBadge variant="source">{hasMapbox ? "Mapbox GL" : "MapLibre GL"}</DataBadge>
          <DataBadge variant="source">USGS</DataBadge>
          <DataBadge variant="live">Live</DataBadge>
          <DataBadge variant="neutral">Updated {updated.toLocaleTimeString()}</DataBadge>
        </div>
      </div>

      <MapFilters value={filters} onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} />
      <ProfessionalWorldMap events={filtered} />
      <MapLegend />
    </div>
  );
}
