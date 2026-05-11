import { useEffect, useRef } from "react";
import mapboxgl, { type Map as MbMap, Marker, Popup } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapEvent } from "@/types";

interface Props {
  events: MapEvent[];
  height?: string;
}

const MAPBOX_TOKEN =
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
  "pk.eyJ1IjoibHVjYXBvY28iLCJhIjoiY21wMWsycTE1MDRiejJxcjFoN3d0Nmt5NyJ9.MQ-Nu5ZbYdCdBagfpinCKQ";

mapboxgl.accessToken = MAPBOX_TOKEN;

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
  const mapRef = useRef<MbMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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
        mapRef.current?.setFog({
          color: "rgb(15, 23, 42)",
          "high-color": "rgb(36, 92, 223)",
          "horizon-blend": 0.02,
          "space-color": "rgb(8, 12, 24)",
          "star-intensity": 0.6,
        } as any);
      });
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
