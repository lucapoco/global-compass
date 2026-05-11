import { useEffect, useState } from "react";
import { Activity, Database, Lock, Radio, Timer } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { getNewsDebugSnapshot, subscribeNewsDebug, type NewsDebugSnapshot } from "@/services/newsApi";

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleTimeString() : "—";
}

function formatAge(ms: number | null): string {
  if (ms == null) return "No cache";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function GNewsDebugPanel() {
  const [snapshot, setSnapshot] = useState<NewsDebugSnapshot>(() => getNewsDebugSnapshot());

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const unsubscribe = subscribeNewsDebug(setSnapshot);
    const tick = window.setInterval(() => setSnapshot(getNewsDebugSnapshot()), 1000);
    return () => {
      unsubscribe();
      window.clearInterval(tick);
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  const rows = [
    { label: "GNews API calls made this session", value: String(snapshot.sessionGNewsCalls), icon: Radio },
    { label: "Last GNews request time", value: formatTime(snapshot.lastRequestAt), icon: Timer },
    { label: "Current news status", value: snapshot.currentStatus.replace("_", " ").toUpperCase(), icon: Activity },
    { label: "Rate limit lock active", value: snapshot.rateLimitActive ? `Yes · until ${formatTime(snapshot.rateLimitUntil)}` : "No", icon: Lock },
    { label: "Cache age", value: `${formatAge(snapshot.cacheAgeMs)} · ${snapshot.cacheItems} items`, icon: Database },
  ];

  return (
    <div className="glass-card mb-4 border-dashed p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium">GNews Debug</div>
        <DataBadge variant="neutral">Development only</DataBadge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                <Icon className="h-3 w-3" /> {row.label}
              </div>
              <div className="mt-1 break-words text-xs font-medium tabular-nums">{row.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}