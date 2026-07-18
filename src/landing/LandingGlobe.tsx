/**

 * LandingGlobe — scroll-driven planetary centerpiece.

 * Uses Mapbox GL globe when a token is available; graceful CSS fallback otherwise.

 */

import { useEffect, useRef, useMemo } from "react";

import mapboxgl from "mapbox-gl";

import type { GlobalEvent } from "@/domain/models/GlobalEvent";



const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;



interface Props {

  progress: number;

  events?: GlobalEvent[];

  className?: string;

}



function severityColor(severity: string): string {

  if (severity === "critical") return "#dc2626";

  if (severity === "high") return "#d97706";

  if (severity === "medium") return "#0284c7";

  return "#059669";

}



export function LandingGlobe({ progress, events = [], className = "" }: Props) {

  const containerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<mapboxgl.Map | null>(null);

  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const rafRef = useRef<number | null>(null);

  const progressRef = useRef(progress);

  const bearingOffsetRef = useRef(0);



  progressRef.current = progress;



  const scale = 0.45 + progress * 0.55;

  const markerOpacity = Math.min(1, Math.max(0, (progress - 0.45) / 0.35));

  const scrollBearing = progress * 120;



  const mappable = useMemo(

    () => events.filter((e) => e.lat != null && e.lng != null).slice(0, 24),

    [events],

  );



  useEffect(() => {

    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;



    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({

      container: containerRef.current,

      style: "mapbox://styles/mapbox/satellite-streets-v12",

      projection: { name: "globe" },

      center: [10, 20],

      zoom: 1.2,

      interactive: false,

      attributionControl: false,

    });



    mapRef.current = map;



    map.on("style.load", () => {

      map.setFog({

        color: "rgb(186, 210, 235)",

        "high-color": "rgb(36, 92, 223)",

        "horizon-blend": 0.08,

        "space-color": "rgb(12, 20, 35)",

        "star-intensity": 0.12,

      });

    });



    const spin = () => {

      const mapInstance = mapRef.current;

      if (mapInstance && progressRef.current < 0.02) {

        bearingOffsetRef.current += 0.04;

        mapInstance.setBearing(bearingOffsetRef.current);

      }

      rafRef.current = requestAnimationFrame(spin);

    };

    rafRef.current = requestAnimationFrame(spin);



    return () => {

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

      markersRef.current.forEach((m) => m.remove());

      markersRef.current = [];

      map.remove();

      mapRef.current = null;

    };

  }, []);



  useEffect(() => {

    const map = mapRef.current;

    if (!map) return;



    const zoom = 1.2 + progress * 1.4;

    const bearing = progress > 0.02 ? scrollBearing : bearingOffsetRef.current;



    map.easeTo({

      zoom,

      bearing,

      pitch: 12 + progress * 18,

      duration: 0,

      essential: true,

    });

  }, [progress, scrollBearing]);



  useEffect(() => {

    const map = mapRef.current;

    if (!map) return;



    markersRef.current.forEach((m) => m.remove());

    markersRef.current = [];



    if (markerOpacity <= 0.05) return;



    for (const ev of mappable) {

      if (ev.lat == null || ev.lng == null) continue;

      const el = document.createElement("div");

      const color = severityColor(ev.severity);

      el.style.cssText = `

        width:8px;height:8px;border-radius:9999px;background:${color};

        border:2px solid rgba(255,255,255,0.9);

        box-shadow:0 2px 6px rgba(15,23,42,0.25);

        opacity:${markerOpacity};

        transform:scale(${0.8 + progress * 0.4});

        transition:opacity 0.4s ease;

      `;

      const marker = new mapboxgl.Marker({ element: el })

        .setLngLat([ev.lng, ev.lat])

        .addTo(map);

      markersRef.current.push(marker);

    }

  }, [mappable, markerOpacity, progress]);



  if (!MAPBOX_TOKEN) {

    return (

      <div

        className={`relative flex items-center justify-center ${className}`}

        style={{ transform: `scale(${scale})`, transition: "transform 0.1s linear" }}

      >

        <div

          className="relative h-[min(52vw,420px)] w-[min(52vw,420px)] rounded-full"

          style={{

            background: "radial-gradient(circle at 32% 28%, #7dd3fc 0%, #0284c7 28%, #0369a1 52%, #0c4a6e 78%, #082f49 100%)",

            boxShadow: "0 24px 64px rgba(2, 132, 199, 0.22), inset -12px -16px 32px rgba(0,0,0,0.15)",

          }}

        >

          <div

            className="absolute inset-0 rounded-full opacity-40 animate-[spin_48s_linear_infinite]"

            style={{

              background: "repeating-conic-gradient(from 0deg, transparent 0deg 8deg, rgba(255,255,255,0.06) 8deg 10deg)",

            }}

          />

          {markerOpacity > 0.2 &&

            mappable.slice(0, 8).map((_, i) => (

              <span

                key={i}

                className="absolute h-2 w-2 rounded-full bg-white/90 border border-sky-200"

                style={{

                  opacity: markerOpacity,

                  top: `${20 + (i * 17) % 60}%`,

                  left: `${15 + (i * 23) % 70}%`,

                }}

              />

            ))}

        </div>

      </div>

    );

  }



  return (

    <div

      className={`relative overflow-hidden rounded-full ${className}`}

      style={{

        width: `min(${420 + progress * 280}px, 92vw)`,

        height: `min(${420 + progress * 280}px, 92vw)`,

        boxShadow: "0 32px 80px rgba(15, 23, 42, 0.12)",

        transition: "width 0.1s linear, height 0.1s linear",

      }}

    >

      <div ref={containerRef} className="h-full w-full" />

      <div

        className="pointer-events-none absolute inset-0 rounded-full"

        style={{ boxShadow: "inset 0 0 48px rgba(15, 23, 42, 0.08)" }}

      />

    </div>

  );

}

