import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, Marker, Popup } from "maplibre-gl";
import type { MapEvent } from "@/types";

interface Props {
  events: MapEvent[];
  height?: string;
}

const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const COLORS: Record<MapEvent["type"], string> = {
  earthquake: "#f59e0b",
  weather: "#22d3ee",
  country: "#a78bfa",
  alert: "#fb7185",
};

function severityColor(sev?: string) {
  switch (sev) {
    case "Critical": return "#fb7185";
    case "High": return "#f59e0b";
    case "Medium": return "#22d3ee";
    default: return "#34d399";
  }
}

export function ProfessionalWorldMap({ events, height = "70vh" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Try Mapbox style if token is provided, else fall back to MapLibre dark tiles.
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    const style = mapboxToken
      ? { version: 8, sources: { mb: { type: "raster", tiles: [`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`], tileSize: 256 } }, layers: [{ id: "mb", type: "raster", source: "mb" }] } as any
      : STYLE_DARK;

    try {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [10, 20],
        zoom: 1.6,
        attributionControl: true,
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    } catch (e) {
      console.error("Map init failed", e);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const ev of events) {
      const el = document.createElement("div");
      const color = ev.type === "earthquake" || ev.type === "alert"
        ? severityColor(ev.severity)
        : COLORS[ev.type];
      el.style.cssText = `
        width:12px;height:12px;border-radius:9999px;background:${color};
        box-shadow:0 0 0 2px rgba(0,0,0,0.6), 0 0 12px ${color};
        cursor:pointer; border:1px solid rgba(255,255,255,0.6);
      `;
      const popup = new Popup({ offset: 14, closeButton: false }).setHTML(`
        <div style="min-width:180px">
          <div style="font-weight:600;font-size:13px;color:#e6f1ff">${ev.title}</div>
          ${ev.description ? `<div style="font-size:11px;color:#9fb3c8;margin-top:4px">${ev.description}</div>` : ""}
          <div style="font-size:10px;color:#7e93a8;margin-top:6px;text-transform:uppercase;letter-spacing:0.08em">${ev.type}${ev.severity ? " · " + ev.severity : ""}</div>
        </div>
      `);
      const marker = new Marker({ element: el }).setLngLat([ev.lng, ev.lat]).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
    }
  }, [events]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl border border-border/60"
    />
  );
}
