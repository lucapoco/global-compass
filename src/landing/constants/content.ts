import {
  Globe2, Map, BarChart2, Network, Cpu, Sparkles, Shield,
  Zap, Radio, Brain, LineChart, Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Navigation anchors — labels from i18n nav.* */
export const NAV_LINKS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "product", href: "#product" },
  { key: "ai", href: "#ai" },
  { key: "pricing", href: "#pricing" },
  { key: "faq", href: "#faq" },
] as const;

export const TRUSTED_BY = [
  "USGS Earthquake Hazards",
  "NASA EONET",
  "ACLED",
  "GNews Intelligence",
  "World Bank Open Data",
  "OpenWeather",
] as const;

export const FEATURE_ITEMS = [
  { id: "monitoring", icon: Globe2, href: "/map" },
  { id: "alerts", icon: Zap, href: "/alert-center" },
  { id: "briefings", icon: Brain, href: "/ai-news" },
  { id: "graph", icon: Network, href: "/knowledge-graph" },
  { id: "analytics", icon: BarChart2, href: "/analytics" },
  { id: "decisions", icon: Shield, href: "/countries" },
] as const;

export const HOW_IT_WORKS_STEPS = [
  { id: "ingest", step: "01", icon: Radio },
  { id: "analyze", step: "02", icon: LineChart },
  { id: "brief", step: "03", icon: Bell },
] as const;

export const PRODUCT_SCREENS = [
  { id: "map", href: "/map", gradient: "from-sky-400/20 via-blue-500/10 to-cyan-300/20" },
  { id: "mission", href: "/mission-control", gradient: "from-slate-800/40 via-indigo-900/30 to-slate-900/50" },
  { id: "analytics", href: "/analytics", gradient: "from-emerald-400/15 via-teal-500/10 to-sky-400/15" },
] as const;

export const AI_CAPABILITY_ITEMS = [
  { id: "summaries", icon: Sparkles },
  { id: "reports", icon: Cpu },
  { id: "chat", icon: Brain },
  { id: "graph", icon: Network },
] as const;

export const TESTIMONIAL_ITEMS = [
  { id: "elena", name: "Elena M." },
  { id: "james", name: "James K." },
  { id: "sofia", name: "Sofia R." },
] as const;

export const PRICING_TIER_IDS = ["community", "professional", "enterprise"] as const;

export const FAQ_ITEM_IDS = ["what", "data", "free", "keys", "presentations", "different"] as const;

export const STAT_ITEM_IDS = [
  "countries",
  "events",
  "critical",
  "earthquakes",
  "weather",
  "reports",
] as const;

export const FOOTER_LINK_GROUPS = {
  product: [
    { key: "dashboard", href: "/dashboard" },
    { key: "worldMap", href: "/map" },
    { key: "missionControl", href: "/mission-control" },
    { key: "analytics", href: "/analytics" },
  ],
  resources: [
    { key: "aiBriefings", href: "/ai-news" },
    { key: "knowledgeGraph", href: "/knowledge-graph" },
    { key: "reports", href: "/reports" },
    { key: "alertCenter", href: "/alert-center" },
  ],
  company: [
    { key: "about", href: "/about" },
    { key: "countries", href: "/countries" },
    { key: "compare", href: "/compare" },
  ],
} as const;

export type FeatureIcon = LucideIcon;
