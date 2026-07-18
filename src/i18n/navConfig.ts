import type { ElementType } from "react";
import {
  LayoutDashboard,
  Bookmark,
  Newspaper,
  BarChart2,
  Cpu,
  Settings,
  History,
  Flag,
  Activity,
  CloudSun,
  GitCompareArrows,
  Info,
  Sparkles,
  FileText,
  Presentation,
  BookMarked,
  Map,
  Network,
  ShieldAlert,
  FolderOpen,
} from "lucide-react";

export interface AppNavItem {
  to: string;
  labelKey: string;
  icon: ElementType;
  badgeKey?: "app.badges.new";
  /** Cloud-only feature — guests see a lock and get the auth modal */
  requiresAuth?: boolean;
  authReason?: string;
}

export interface AppNavGroup {
  labelKey: string;
  items: AppNavItem[];
}

/**
 * Original platform navigation (Command Center → Intelligence → Data Sources → Platform).
 * Auth flags gate cloud persistence only; guests can still browse everything else.
 */
export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    labelKey: "app.nav.groups.commandCenter",
    items: [
      { to: "/mission-control", labelKey: "app.nav.missionControl", icon: Cpu, badgeKey: "app.badges.new" },
      { to: "/alert-center", labelKey: "app.nav.alertCenter", icon: ShieldAlert, badgeKey: "app.badges.new" },
      { to: "/dashboard", labelKey: "app.nav.dashboard", icon: LayoutDashboard },
      { to: "/intelligence", labelKey: "app.nav.intelligenceFeed", icon: Newspaper },
      {
        to: "/watchlist",
        labelKey: "app.nav.watchCenter",
        icon: BookMarked,
        requiresAuth: true,
        authReason: "watchlist",
      },
      { to: "/analytics", labelKey: "app.nav.analytics", icon: BarChart2 },
    ],
  },
  {
    labelKey: "app.nav.groups.intelligence",
    items: [
      { to: "/ai-news", labelKey: "app.nav.globalPulseAi", icon: Sparkles },
      { to: "/knowledge-graph", labelKey: "app.nav.knowledgeGraph", icon: Network, badgeKey: "app.badges.new" },
      { to: "/reports", labelKey: "app.nav.intelligenceReports", icon: FileText },
      { to: "/compare", labelKey: "app.nav.compareCountries", icon: GitCompareArrows },
      { to: "/map", labelKey: "app.nav.liveWorldMap", icon: Map },
    ],
  },
  {
    labelKey: "app.nav.groups.dataSources",
    items: [
      { to: "/countries", labelKey: "app.nav.countries", icon: Flag },
      { to: "/earthquakes", labelKey: "app.nav.earthquakes", icon: Activity },
      { to: "/weather", labelKey: "app.nav.weather", icon: CloudSun },
    ],
  },
  {
    labelKey: "app.nav.groups.platform",
    items: [
      {
        to: "/saved",
        labelKey: "app.nav.savedData",
        icon: Bookmark,
        requiresAuth: true,
        authReason: "saved_data",
      },
      {
        to: "/saved-articles",
        labelKey: "app.nav.savedArticles",
        icon: Bookmark,
        requiresAuth: true,
        authReason: "save_article",
      },
      {
        to: "/reading-history",
        labelKey: "app.nav.readingHistory",
        icon: History,
        requiresAuth: true,
        authReason: "reading_history",
      },
      {
        to: "/collections",
        labelKey: "app.nav.collections",
        icon: FolderOpen,
        requiresAuth: true,
        authReason: "collections",
      },
      { to: "/settings", labelKey: "app.nav.settings", icon: Settings },
      { to: "/about", labelKey: "app.nav.aboutProject", icon: Info },
      { to: "/presentation", labelKey: "app.nav.presentationMode", icon: Presentation },
    ],
  },
];
