import { Activity, Heart, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DataBadge } from "@/components/ui/DataBadge";
import type { NewsStatus } from "@/services/newsApi";

interface Props {
  status: NewsStatus;
  updated: Date;
  loading?: boolean;
  cooldownLeft?: number;
  onRefresh: () => void;
}

function variant(s: NewsStatus): "live" | "neutral" | "demo" | "error" {
  if (s === "live") return "live";
  if (s === "cached") return "neutral";
  if (s === "rate_limited" || s === "error") return "error";
  return "demo";
}
function label(s: NewsStatus): string {
  switch (s) {
    case "live": return "LIVE";
    case "cached": return "CACHED";
    case "rate_limited": return "RATE LIMITED";
    case "error": return "API ERROR";
    case "demo": return "DEMO";
  }
}

export function DashboardStatusBar({ status, updated, loading, cooldownLeft = 0, onRefresh }: Props) {
  const disabled = loading || cooldownLeft > 0;
  return (
    <div className="glass-card panel-grid relative overflow-hidden p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-glow/15 blur-3xl" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <DataBadge variant={variant(status)}>{label(status)}</DataBadge>
            <DataBadge variant="source">Global Pulse</DataBadge>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">World Monitoring Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time insights about our planet</p>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Last updated · {updated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={disabled}
            title={cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Refresh all dashboard data"}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Refresh"}
          </button>
          <a href="#api-health" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs hover:text-primary">
            <Heart className="h-3.5 w-3.5 text-rose-glow" /> API Health
          </a>
          <Link to="/map" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs hover:text-primary">
            <Activity className="h-3.5 w-3.5" /> Map
          </Link>
        </div>
      </div>
    </div>
  );
}
