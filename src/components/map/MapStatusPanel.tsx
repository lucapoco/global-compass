import type { ProviderStatusSnapshot } from "@/domain/services/event-engine/providers";
import { useT } from "@/i18n";

interface Props {
  totalEvents: number;
  visibleEvents: number;
  providerStatus: ProviderStatusSnapshot[];
  lastUpdated: Date | null;
}

function statusDot(status: ProviderStatusSnapshot["status"]) {
  const color = status === "fresh" ? "bg-emerald-glow" : status === "stale" ? "bg-amber-glow" : status === "error" ? "bg-rose-glow" : "bg-muted-foreground/40";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

/** Small live-status panel: total/visible events, per-provider cache freshness, last refresh. */
export function MapStatusPanel({ totalEvents, visibleEvents, providerStatus, lastUpdated }: Props) {
  const t = useT();
  const liveCount = providerStatus.filter((p) => p.status === "fresh" && p.itemCount > 0).length;

  return (
    <div className="glass-card flex flex-wrap items-center gap-3 p-2 text-[11px]">
      <span className="text-muted-foreground">
        {t("app.pages.map.ui.eventsVisible", { visible: visibleEvents, total: totalEvents })}
      </span>
      <span className="hidden h-4 w-px bg-border/60 sm:inline" />
      <span className="text-muted-foreground">
        {t("app.pages.map.ui.liveProviders", { count: liveCount })}
      </span>
      <span className="hidden h-4 w-px bg-border/60 sm:inline" />
      <div className="flex flex-wrap items-center gap-2">
        {providerStatus.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 text-muted-foreground" title={`${p.label}: ${p.status}${p.error ? ` — ${p.error}` : ""}`}>
            {statusDot(p.status)} {p.label.split(" ")[0]} ({p.itemCount})
          </span>
        ))}
      </div>
      <span className="hidden h-4 w-px bg-border/60 sm:inline" />
      <span suppressHydrationWarning className="text-muted-foreground">
        {lastUpdated
          ? t("app.pages.map.ui.refreshedAt", { time: lastUpdated.toLocaleTimeString() })
          : t("app.pages.map.ui.notYetRefreshed")}
      </span>
    </div>
  );
}
