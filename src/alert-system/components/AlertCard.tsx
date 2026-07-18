/**
 * AlertCard — Compact alert summary card for list views (light theme).
 */
import { AlertCircle, MapPin, Users, Clock } from "lucide-react";
import type { GlobalAlert } from "../types";
import { ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS } from "../types";
import { useT } from "@/i18n";

interface Props {
  alert: GlobalAlert;
  onClick: () => void;
  selected?: boolean;
}

const SOURCE_ICONS: Record<string, string> = {
  breaking_news: "📡", earthquake: "⚡", weather: "🌪️", wildfire: "🔥",
  flood: "🌊", volcano: "🌋", conflict: "⚔️", cyber: "🔐",
  economic: "📈", health: "🏥", energy: "⚡", other: "📌",
};

function ageLabel(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return t("app.ui.time.lessThanOneHour");
  if (h < 24) return t("app.ui.time.hoursAgo", { count: h });
  return t("app.ui.time.daysAgo", { count: Math.floor(h / 24) });
}

export function AlertCard({ alert, onClick, selected }: Props) {
  const t = useT();
  const color = ALERT_LEVEL_COLORS[alert.level];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-all duration-150 ${
        selected
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-border hover:bg-muted/40 hover:shadow-sm"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-base" aria-hidden="true">{SOURCE_ICONS[alert.sourceType] ?? "📌"}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ color, background: `${color}18` }}
            >
              {ALERT_LEVEL_LABELS[alert.level]}
            </span>
            {alert.multiSourceConfirmed && (
              <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
                {t("app.ui.sourcesCount", { count: alert.sourceCount })}
              </span>
            )}
            {alert.status === "resolved" && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {t("app.ui.resolved")}
              </span>
            )}
          </div>
          <div className="truncate text-sm font-medium text-foreground">{alert.title}</div>
          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{alert.summary}</div>

          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            {alert.affectedCountries.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {alert.affectedCountries[0]}
                {alert.affectedCountries.length > 1 ? ` +${alert.affectedCountries.length - 1}` : ""}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {alert.supportingEventIds.length}
            </span>
            <span className="flex items-center gap-1" suppressHydrationWarning>
              <Clock className="h-2.5 w-2.5" />
              {ageLabel(alert.lastUpdatedAt, t)}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold" style={{ color }}>{alert.riskScore}</div>
          <div className="text-[8px] uppercase tracking-wide text-muted-foreground">{t("app.ui.risk")}</div>
        </div>
      </div>
    </button>
  );
}

export function AlertCardCompact({ alert }: { alert: GlobalAlert }) {
  const color = ALERT_LEVEL_COLORS[alert.level];
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <AlertCircle className="h-3 w-3 shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1 truncate text-foreground/80">{alert.title}</span>
      <span className="shrink-0 font-mono text-muted-foreground">{alert.riskScore}</span>
    </div>
  );
}
