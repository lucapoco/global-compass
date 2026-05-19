import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Globe2, Flag, Activity, CloudSun,
  AlertTriangle, GitCompareArrows, Bookmark, Info, Radio, Newspaper, Sparkles, FileText, Presentation,
} from "lucide-react";
import { ViewModeToggle } from "./ViewModeToggle";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/intelligence", label: "Intelligence Feed", icon: Newspaper },
  { to: "/ai-news", label: "Global Pulse AI", icon: Sparkles },
  { to: "/reports", label: "Intelligence Reports", icon: FileText },
  { to: "/map", label: "Live World Map", icon: Globe2 },
  { to: "/countries", label: "Countries", icon: Flag },
  { to: "/earthquakes", label: "Earthquakes", icon: Activity },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/alerts", label: "Global Alerts", icon: AlertTriangle },
  { to: "/compare", label: "Compare Countries", icon: GitCompareArrows },
  { to: "/saved", label: "Saved Data", icon: Bookmark },
  { to: "/about", label: "About Project", icon: Info },
  { to: "/presentation", label: "Presentation Mode", icon: Presentation },
] as const;

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-2 border-r border-border/60 bg-card/30 backdrop-blur-md p-4">
      <div className="flex items-center gap-2 px-2 py-3">
        <div className="relative">
          <Radio className="h-6 w-6 text-primary" />
          <span className="absolute -right-1 -top-1 live-dot" />
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight">Global Pulse</div>
          <div className="text-[11px] text-muted-foreground">Real-time planet insights</div>
        </div>
      </div>
      <nav className="mt-2 flex flex-col gap-1">
        {items.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 px-2">
        <ViewModeToggle />
        <div className="text-[11px] text-muted-foreground">InfoEducație · Educational project</div>
      </div>
    </aside>
  );
}
