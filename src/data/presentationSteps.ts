import type { LucideIcon } from "lucide-react";
import {
  Radio,
  Newspaper,
  Globe2,
  Sparkles,
  FileText,
  Bookmark,
  Layers,
} from "lucide-react";

export type PresentationStep = {
  id: string;
  title: string;
  explanation: string;
  featureTo: string;
  featureLabel: string;
  icon: LucideIcon;
  previewTitle: string;
  previewBullets: string[];
  previewAccent: string;
};

export const PRESENTATION_STEPS: PresentationStep[] = [
  {
    id: "intro",
    title: "Introduction to Global Pulse",
    explanation:
      "Global Pulse is an educational planetary monitoring dashboard for InfoEducație. It aggregates public intelligence, seismic, weather, and country data into one dark, analyst-style interface — with clear LIVE, CACHED, and DEMO labels so users always know what they are looking at.",
    featureTo: "/dashboard",
    featureLabel: "Open Dashboard",
    icon: Radio,
    previewTitle: "Mission control overview",
    previewBullets: [
      "Live KPI cards: earthquakes, alerts, intelligence count",
      "Critical signals and API health at a glance",
      "Quick actions to every major feature",
    ],
    previewAccent: "from-primary/25 via-primary/5 to-background",
  },
  {
    id: "intelligence",
    title: "Live Intelligence Feed",
    explanation:
      "Headlines from GNews flow through a same-origin proxy with caching and demo fallback. Filter by category, severity, and region; open details for source links and context. Nothing is invented — status badges show whether data is live or cached.",
    featureTo: "/intelligence",
    featureLabel: "Open Intelligence Feed",
    icon: Newspaper,
    previewTitle: "Curated headline stream",
    previewBullets: [
      "Categories: geopolitics, economy, cyber, military, disasters",
      "Severity chips and search filters",
      "Map integration for geolocated events",
    ],
    previewAccent: "from-amber-500/20 via-background to-background",
  },
  {
    id: "map",
    title: "Globe Map Control Center",
    explanation:
      "A professional dark MapLibre world map layers earthquakes, intelligence markers, and country context. Pan, zoom, filter by category, and inspect events in the side panel — the spatial heart of situational awareness.",
    featureTo: "/map",
    featureLabel: "Open Live World Map",
    icon: Globe2,
    previewTitle: "Geospatial command view",
    previewBullets: [
      "Interactive globe with category filters",
      "Earthquake and intelligence markers",
      "Country focus and event side panel",
    ],
    previewAccent: "from-cyan-500/15 via-background to-background",
  },
  {
    id: "ai",
    title: "Global Pulse AI",
    explanation:
      "Ask questions about breaking news, the map, and country risk. The server uses Google Gemini when configured, with retries, fallback models, and a local rule-based fallback — always grounded in data already loaded in the app.",
    featureTo: "/ai-news",
    featureLabel: "Open Global Pulse AI",
    icon: Sparkles,
    previewTitle: "Grounded AI analyst",
    previewBullets: [
      "Chat powered by in-app context payload",
      "GEMINI LIVE / LOCAL FALLBACK status badges",
      "Suggested prompts for jury demos",
    ],
    previewAccent: "from-violet-500/20 via-background to-background",
  },
  {
    id: "reports",
    title: "Intelligence Reports",
    explanation:
      "Generate Country Reports, Event Reports, and Global Briefings from live, cached, or demo data. Optional Gemini polish; structured local fallback when AI is busy. Save to Supabase, view history, and print export.",
    featureTo: "/reports",
    featureLabel: "Open Intelligence Reports",
    icon: FileText,
    previewTitle: "Structured briefings",
    previewBullets: [
      "Country, event, and global briefing types",
      "Risk scores, earthquakes, saved items",
      "Save, delete, and print-friendly export",
    ],
    previewAccent: "from-emerald-500/15 via-background to-background",
  },
  {
    id: "saved",
    title: "Supabase Saved Data",
    explanation:
      "Persist bookmarks across sessions: saved countries, alerts, intelligence items, and generated reports. Row-level security with demo policies; project_logs audit trail for educational transparency.",
    featureTo: "/saved",
    featureLabel: "Open Saved Data",
    icon: Bookmark,
    previewTitle: "Cloud persistence layer",
    previewBullets: [
      "saved_countries, saved_alerts, saved_intelligence",
      "generated_reports from Intelligence Reports",
      "Debug panel shows Supabase connection status",
    ],
    previewAccent: "from-rose-500/15 via-background to-background",
  },
  {
    id: "architecture",
    title: "Architecture and data sources",
    explanation:
      "React 19 + TanStack Router on Cloudflare Workers, MapLibre for maps, Recharts for analytics. Public APIs: GNews (proxy), USGS, REST Countries, OpenWeather; Supabase for storage; Gemini for optional AI — all with explicit limitation labels.",
    featureTo: "/about",
    featureLabel: "Open About & Sources",
    icon: Layers,
    previewTitle: "Stack and ethics",
    previewBullets: [
      "TanStack Start · Vite · Tailwind · TypeScript",
      "Server routes for AI and GNews proxy",
      "Educational use only — not operational intelligence",
    ],
    previewAccent: "from-slate-500/20 via-background to-background",
  },
];
