import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import mapboxgl, { type Map as MbMap, Marker, Popup } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EventLayer, EventSeverity, GlobalEvent } from "@/types";

interface Props {
  events: GlobalEvent[];
  height?: string;
  heatmap?: boolean;
  selectedEventId?: string | null;
  onMarkerSelect?: (e: GlobalEvent) => void;
}

export interface ProfessionalWorldMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  resetView: () => void;
}

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim();

const LAYER_COLOR: Record<EventLayer, string> = {
  earthquakes: "#f59e0b",
  intelligence: "#38bdf8",
  saved_alerts: "#fb7185",
  weather: "#22d3ee",
  capitals: "#a78bfa",
};

function markerBaseColor(ev: GlobalEvent): string {
  if (ev.layer === "earthquakes" || ev.layer === "saved_alerts") return severityColor(ev.severity);
  return LAYER_COLOR[ev.layer];
}

function severityColor(sev: EventSeverity): string {
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

function heatmapGlowPx(sev: EventSeverity, heatmap: boolean): number {
  if (!heatmap) return 12;
  if (sev === "critical") return 42;
  if (sev === "high") return 32;
  if (sev === "medium") return 24;
  return 14;
}

export const ProfessionalWorldMap = forwardRef<ProfessionalWorldMapHandle, Props>(
  function ProfessionalWorldMap(
    { events, height = "70vh", heatmap = false, selectedEventId, onMarkerSelect },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MbMap | null>(null);
    const markersRef = useRef<Marker[]>([]);

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
      if (!MAPBOX_TOKEN || !map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const plotted = events.filter((e) => e.latitude != null && e.longitude != null);
      for (const ev of plotted) {
        const lat = ev.latitude!;
        const lng = ev.longitude!;
        const el = document.createElement("div");
        const color = markerBaseColor(ev);
        const size = heatmap ? 26 : 12;
        const glow = heatmapGlowPx(ev.severity, heatmap);
        const selected = selectedEventId === ev.id;
        el.style.cssText = `
          width:${size}px;height:${size}px;border-radius:9999px;background:${color};
          opacity:${heatmap ? 0.65 : 1};
          box-shadow:0 0 0 ${selected ? 3 : 2}px ${selected ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.6)"}, 0 0 ${glow}px ${color};
          cursor:pointer; border:1px solid rgba(255,255,255,${heatmap ? 0.35 : 0.65});
          mix-blend-mode:${heatmap ? "screen" : "normal"};
        `;
        el.addEventListener("click", (evt) => {
          evt.stopPropagation();
          onMarkerSelect?.(ev);
        });

        const popupRoot = document.createElement("div");
        popupRoot.style.minWidth = "200px";
        popupRoot.style.color = "#e6f1ff";
        popupRoot.innerHTML = `
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(ev.title)}</div>
          ${ev.description ? `<div style="font-size:11px;color:#9fb3c8;margin-bottom:6px">${escapeHtml(ev.description)}</div>` : ""}
          <div style="font-size:10px;color:#7e93a8;text-transform:uppercase;letter-spacing:0.08em">
            ${escapeHtml(ev.layer)} · ${escapeHtml(ev.severity)} · ${escapeHtml(ev.category)}
          </div>
          <div style="font-size:10px;color:#7e93a8;margin-top:4px">${escapeHtml(ev.source)} · ${escapeHtml(new Date(ev.publishedAt).toLocaleString())}</div>
          ${ev.url ? `<div style="margin-top:8px"><a href="${escapeAttr(ev.url)}" target="_blank" rel="noreferrer" style="color:#38bdf8;font-size:11px">Open source</a></div>` : ""}
        `;

        const popup = new Popup({ offset: 14, closeButton: true, maxWidth: "300px" }).setDOMContent(popupRoot);
        const marker = new Marker({ element: el }).setLngLat([lng, lat]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      }
    }, [events, heatmap, selectedEventId, onMarkerSelect]);

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
