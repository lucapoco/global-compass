import type { LucideIcon } from "lucide-react";
import {
  Radio,
  Newspaper,
  Globe2,
  Sparkles,
  FileText,
  Bookmark,
  Layers,
  ShieldAlert,
  Network,
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
      "Global Pulse is an educational Planetary Intelligence platform for InfoEducație. It aggregates public intelligence, seismic, weather, and country data into one analyst-style interface — with clear LIVE, CACHED, and DEMO labels so users always know what they are looking at.",
    featureTo: "/dashboard",
    featureLabel: "Open Dashboard",
    icon: Radio,
    previewTitle: "Mission overview",
    previewBullets: [
      "Live KPI cards: earthquakes, alerts, intelligence count",
      "Mission Control and critical signals at a glance",
      "Quick actions to every major feature",
    ],
    previewAccent: "from-primary/25 via-primary/5 to-background",
  },
  {
    id: "intelligence",
    title: "Live Intelligence Feed",
    explanation:
      "Headlines from GNews flow through a same-origin proxy with caching and demo fallback. Filter by category, severity, and region; open details for source links and context. Status badges show whether data is live, cached, or demo.",
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
      "A Mapbox GL world map layers earthquakes, intelligence markers, alerts, and country context. Pan, zoom, filter by category, and inspect events in the side panel — the spatial heart of situational awareness.",
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
    id: "alerts",
    title: "Alert Center & Watchlists",
    explanation:
      "The Alert Center evaluates live intelligence for severity, correlation, and crisis signals. Users can build watchlists and receive a focused operational view of what matters most.",
    featureTo: "/alert-center",
    featureLabel: "Open Alert Center",
    icon: ShieldAlert,
    previewTitle: "Continuous evaluation",
    previewBullets: [
      "Severity and confidence scoring",
      "Crisis detection and watchlists",
      "Auth-gated personalization when signed in",
    ],
    previewAccent: "from-orange-500/15 via-background to-background",
  },
  {
    id: "graph",
    title: "Knowledge Graph",
    explanation:
      "Explore relationships between events, countries, and themes on an interactive graph (XYFlow). Useful for explaining how signals connect beyond a flat news list.",
    featureTo: "/knowledge-graph",
    featureLabel: "Open Knowledge Graph",
    icon: Network,
    previewTitle: "Relational exploration",
    previewBullets: [
      "Nodes for events, places, and topics",
      "Search and inspect connected entities",
      "Complements the map and intelligence feed",
    ],
    previewAccent: "from-indigo-500/15 via-background to-background",
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
    title: "Saved Data & Collections",
    explanation:
      "Sign in to persist bookmarks across sessions: saved countries, alerts, intelligence, personal collections, and reading history. Row Level Security isolates each user's data (`user_id = auth.uid()`).",
    featureTo: "/collections",
    featureLabel: "Open Collections",
    icon: Bookmark,
    previewTitle: "Cloud personal workspace",
    previewBullets: [
      "Collections with add / rename / delete",
      "Saved articles and reading history",
      "Email, Google, and GitHub authentication",
    ],
    previewAccent: "from-rose-500/15 via-background to-background",
  },
  {
    id: "architecture",
    title: "Architecture and data sources",
    explanation:
      "React 19 + TanStack Start (SSR & API routes) on Nitro / Vercel, Mapbox GL for maps, Recharts for analytics. Public APIs: GNews, USGS, REST Countries, OpenWeather, plus ACLED, FIRMS, GDACS, GDELT, ReliefWeb; Supabase for auth & storage; Gemini for optional AI — all with explicit limitation labels.",
    featureTo: "/about",
    featureLabel: "Open About & Sources",
    icon: Layers,
    previewTitle: "Stack and ethics",
    previewBullets: [
      "TanStack Start · Vite · Tailwind · TypeScript · Nitro",
      "Server proxies keep API keys off the client",
      "Educational use only — not operational intelligence",
    ],
    previewAccent: "from-slate-500/20 via-background to-background",
  },
];
