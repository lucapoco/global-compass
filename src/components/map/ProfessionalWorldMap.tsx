import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import mapboxgl, { type Map as MbMap, Marker, Popup } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GlobalEvent, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import type { EventCluster, MapViewport, MapVisualizationMode } from "@/domain/services/map-engine";
import type { HeatmapFeatureCollection } from "@/domain/services/map-engine/heatmap/heatmapData";
import type { RelationLineFeatureCollection } from "@/domain/services/map-engine/relationships/relatedEventLines";

interface Props {
  clusters: EventCluster[];
  visualizationMode: MapVisualizationMode;
  heatmapData: HeatmapFeatureCollection;
  relationLines: RelationLineFeatureCollection;
  selectedEventId?: string | null;
  onSelectEvent?: (e: GlobalEvent) => void;
  onExpandCluster?: (cluster: EventCluster) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  height?: string;
}

export interface ProfessionalWorldMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  resetView: () => void;
}

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim();
const HEATMAP_SOURCE_ID = "gp-heatmap-source";
const HEATMAP_LAYER_ID = "gp-heatmap-layer";
const LINES_SOURCE_ID = "gp-relation-lines-source";
const LINES_LAYER_ID = "gp-relation-lines-layer";

function severityColor(sev: GlobalEventSeverity): string {
  switch (sev) {
    case "critical":
      return "#fb7185";
    case "high":
      return "#f59e0b";
    case "medium":
      return "#22d3ee";
    default:
      return "#34d399";
  }
}

function markerColor(cluster: EventCluster): string {
  if (cluster.dominantCategory === "country") return "#a78bfa";
  return severityColor(cluster.averageSeverity);
}

function categoryAbbrev(category: string): string {
  return category.slice(0, 3).toUpperCase();
}

export const ProfessionalWorldMap = forwardRef<ProfessionalWorldMapHandle, Props>(
  function ProfessionalWorldMap(
    { clusters, visualizationMode, heatmapData, relationLines, selectedEventId, onSelectEvent, onExpandCluster, onViewportChange, height = "70vh" },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MbMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const styleLoadedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 4) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.4, essential: true });
      },
      resetView: () => {
        mapRef.current?.flyTo({ center: [10, 20], zoom: 1.6, speed: 1.4, essential: true });
      },
    }));

    useEffect(() => {
      if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      try {
        mapRef.current = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [10, 20],
          zoom: 1.6,
          projection: "globe" as any,
          attributionControl: true,
        });
        mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current.on("style.load", () => {
          styleLoadedRef.current = true;
          mapRef.current?.setFog({
            color: "rgb(15, 23, 42)",
            "high-color": "rgb(36, 92, 223)",
            "horizon-blend": 0.02,
            "space-color": "rgb(8, 12, 24)",
            "star-intensity": 0.6,
          } as any);
          addHeatmapLayer(mapRef.current!);
          addRelationLinesLayer(mapRef.current!);
        });

        const emitViewport = () => {
          const map = mapRef.current;
          if (!map || !onViewportChange) return;
          const center = map.getCenter();
          onViewportChange({ center: [center.lng, center.lat], zoom: map.getZoom() });
        };
        mapRef.current.on("zoomend", emitViewport);
        mapRef.current.on("moveend", emitViewport);
      } catch (e) {
        console.error("Map init failed", e);
      }

      return () => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        mapRef.current?.remove();
        mapRef.current = null;
        styleLoadedRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Markers / clusters
    useEffect(() => {
      const map = mapRef.current;
      if (!MAPBOX_TOKEN || !map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (visualizationMode === "heatmap") return;

      for (const cluster of clusters) {
        const el = document.createElement("div");
        const color = markerColor(cluster);
        const isCluster = cluster.count > 1;
        const size = isCluster ? Math.min(56, 22 + Math.log2(cluster.count) * 8) : 12;
        const selected = !isCluster && selectedEventId === cluster.soleEvent?.id;

        if (isCluster) {
          el.style.cssText = `
            width:${size}px;height:${size}px;border-radius:9999px;background:${color};
            opacity:0.85;display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 2px rgba(0,0,0,0.55), 0 0 16px ${color};
            cursor:pointer;border:1.5px solid rgba(255,255,255,0.75);
            color:#0b1220;font-weight:700;font-size:${size > 40 ? 13 : 11}px;font-family:inherit;
          `;
          el.title = `${cluster.count} events · ${cluster.dominantCategory} · avg ${cluster.averageSeverity}`;
          el.textContent = String(cluster.count);
          el.addEventListener("click", (evt) => {
            evt.stopPropagation();
            onExpandCluster?.(cluster);
          });
        } else {
          el.style.cssText = `
            width:${size}px;height:${size}px;border-radius:9999px;background:${color};
            box-shadow:0 0 0 ${selected ? 3 : 2}px ${selected ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.6)"}, 0 0 10px ${color};
            cursor:pointer;border:1px solid rgba(255,255,255,0.65);
          `;
          if (cluster.soleEvent) {
            const ev = cluster.soleEvent;
            el.addEventListener("click", (evt) => {
              evt.stopPropagation();
              onSelectEvent?.(ev);
            });

            const popupRoot = document.createElement("div");
            popupRoot.style.minWidth = "200px";
            popupRoot.style.color = "#e6f1ff";
            popupRoot.innerHTML = `
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(ev.title)}</div>
              ${ev.description ? `<div style="font-size:11px;color:#9fb3c8;margin-bottom:6px">${escapeHtml(ev.description.slice(0, 160))}</div>` : ""}
              <div style="font-size:10px;color:#7e93a8;text-transform:uppercase;letter-spacing:0.08em">
                ${escapeHtml(cluster.dominantCategory)} · ${escapeHtml(ev.severity)} · risk ${ev.riskScore}
              </div>
              <div style="font-size:10px;color:#7e93a8;margin-top:4px">${escapeHtml(ev.source)} · ${escapeHtml(new Date(ev.timestamp).toLocaleString())}</div>
              ${ev.sourceUrl ? `<div style="margin-top:8px"><a href="${escapeAttr(ev.sourceUrl)}" target="_blank" rel="noreferrer" style="color:#38bdf8;font-size:11px">Open source</a></div>` : ""}
            `;
            const popup = new Popup({ offset: 14, closeButton: true, maxWidth: "300px" }).setDOMContent(popupRoot);
            const marker = new Marker({ element: el }).setLngLat([cluster.lng, cluster.lat]).setPopup(popup).addTo(map);
            markersRef.current.push(marker);
            continue;
          }
        }

        const marker = new Marker({ element: el }).setLngLat([cluster.lng, cluster.lat]).addTo(map);
        markersRef.current.push(marker);
      }
    }, [clusters, visualizationMode, selectedEventId, onSelectEvent, onExpandCluster]);

    // Heatmap layer data + visibility
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleLoadedRef.current) return;
      const src = map.getSource(HEATMAP_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      src?.setData(heatmapData as any);
      const visible = visualizationMode === "heatmap" || visualizationMode === "both";
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", visible ? "visible" : "none");
      }
    }, [heatmapData, visualizationMode]);

    // Relation lines data
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleLoadedRef.current) return;
      const src = map.getSource(LINES_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      src?.setData(relationLines as any);
    }, [relationLines]);

    if (!MAPBOX_TOKEN) {
      return (
        <div
          style={{ height }}
          className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border/60 bg-card/30 px-6 text-center text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">Mapbox token not configured</p>
          <p className="max-w-md text-xs">
            Add <code className="rounded bg-muted px-1 py-0.5 text-foreground">VITE_MAPBOX_TOKEN</code> to your{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env</code> file to load the globe map. Public tokens can be created in your Mapbox account.
          </p>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        style={{ height }}
        className="relative w-full overflow-hidden rounded-xl border border-border/60"
      />
    );
  },
);

function addHeatmapLayer(map: MbMap) {
  if (map.getSource(HEATMAP_SOURCE_ID)) return;
  map.addSource(HEATMAP_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } as any });
  map.addLayer({
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: HEATMAP_SOURCE_ID,
    layout: { visibility: "none" },
    paint: {
      "heatmap-weight": ["get", "weight"],
      "heatmap-intensity": 1.1,
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 6, 30, 12, 60],
      "heatmap-opacity": 0.75,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0, "rgba(0,0,0,0)",
        0.2, "#22d3ee",
        0.4, "#34d399",
        0.6, "#f59e0b",
        0.8, "#fb7185",
        1, "#ef4444",
      ],
    },
  });
}

function addRelationLinesLayer(map: MbMap) {
  if (map.getSource(LINES_SOURCE_ID)) return;
  map.addSource(LINES_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } as any });
  map.addLayer({
    id: LINES_LAYER_ID,
    type: "line",
    source: LINES_SOURCE_ID,
    paint: {
      "line-color": "#38bdf8",
      "line-width": 1.6,
      "line-opacity": 0.7,
      "line-dasharray": [2, 1.5],
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
