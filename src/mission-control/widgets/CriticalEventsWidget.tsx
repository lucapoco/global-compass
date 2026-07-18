/**
 * CriticalEventsWidget — Live feed of critical and high-severity events (light theme).
 */
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { WidgetContainer } from "../components/WidgetContainer";
import type { MissionControlState } from "../types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { useT } from "@/i18n";

interface Props {
  state: MissionControlState;
  presentationMode?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  earthquake:  "⚡", military: "⚔️", geopolitics: "🏛️", economy: "📈",
  disaster: "🔥", cyber: "🔐", health: "🏥", weather: "🌪️", climate: "🌡️",
  technology: "💻", energy: "⚡", general: "📡", country: "🌍",
};

const SEV_STYLE: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50/80 text-red-800",
  high:     "border-l-orange-500 bg-orange-50/80 text-orange-800",
};

function ageLabel(timestamp: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return t("app.ui.time.hoursAgo", { count: h });
  if (m > 0) return t("app.ui.time.minutesAgo", { count: m });
  return t("app.ui.time.justNow");
}

function EventRow({ event, pm, t }: { event: GlobalEvent; pm?: boolean; t: (key: string, params?: Record<string, string | number>) => string }) {
  const icon = CATEGORY_ICONS[event.category] ?? "📌";
  const sevStyle = SEV_STYLE[event.severity] ?? SEV_STYLE.high;

  return (
    <div className={`flex items-start gap-2 rounded-r-lg border-l-2 py-1.5 pl-2 transition-all duration-300 hover:bg-[#F8FAFC] ${sevStyle}`}>
      <span className="mt-0.5 shrink-0 text-sm leading-tight">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`line-clamp-1 font-medium leading-tight text-[#0F172A] ${pm ? "text-xs" : "text-[11px]"}`}>
          {event.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {event.country && (
            <span className={`truncate text-[#64748B] ${pm ? "text-[11px]" : "text-[9px]"}`}>{event.country}</span>
          )}
          <span className={`shrink-0 text-[#94A3B8] ${pm ? "text-[10px]" : "text-[9px]"}`} suppressHydrationWarning>
            {ageLabel(event.timestamp, t)}
          </span>
        </div>
      </div>
      <div
        className="shrink-0 font-mono text-[10px] font-bold leading-tight"
        style={{ color: event.severity === "critical" ? "#EF4444" : "#F97316" }}
      >
        {event.riskScore}
      </div>
    </div>
  );
}

export function CriticalEventsWidget({ state, presentationMode }: Props) {
  const t = useT();
  const { criticalEvents, events } = state;

  const displayEvents = useMemo(() => {
    const crit = events.filter((e) => e.severity === "critical");
    const high = events.filter((e) => e.severity === "high");
    return [...crit, ...high]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 18);
  }, [events]);

  const critCount = criticalEvents.length;
  const highCount = events.filter((e) => e.severity === "high").length;

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.eventsFeed")}
      icon={<AlertTriangle className="h-4 w-4" />}
      statusDot={critCount > 0 ? "red" : highCount > 0 ? "amber" : "green"}
      presentationMode={presentationMode}
      className="h-full"
      actions={
        <div className="flex items-center gap-2 text-[9px]">
          {critCount > 0 && (
            <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-red-700">
              {critCount} CRIT
            </span>
          )}
          {highCount > 0 && (
            <span className="rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-orange-700">
              {highCount} HIGH
            </span>
          )}
        </div>
      }
    >
      <div className="panel-scroll h-full space-y-1">
        {displayEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] text-[#64748B]">
            {t("app.pages.missionControl.widgets.noCriticalHigh")}
          </div>
        ) : (
          displayEvents.map((e) => <EventRow key={e.id} event={e} pm={presentationMode} t={t} />)
        )}
      </div>
    </WidgetContainer>
  );
}
