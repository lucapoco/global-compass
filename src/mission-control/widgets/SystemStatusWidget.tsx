/**
 * SystemStatusWidget — Platform operational health (light theme).
 */
import { useMemo, type ReactNode } from "react";
import { Cpu, CheckCircle, AlertCircle, XCircle, HelpCircle, Database } from "lucide-react";
import { WidgetContainer } from "../components/WidgetContainer";
import type { MissionControlState, ProviderHealthStatus } from "../types";
import { useT } from "@/i18n";

interface Props {
  state: MissionControlState;
  presentationMode?: boolean;
}

const STATUS_ICONS: Record<ProviderHealthStatus, ReactNode> = {
  online:   <CheckCircle className="h-3 w-3 text-emerald-600" />,
  degraded: <AlertCircle className="h-3 w-3 text-amber-600" />,
  offline:  <XCircle className="h-3 w-3 text-red-600" />,
  unknown:  <HelpCircle className="h-3 w-3 text-[#94A3B8]" />,
};

const STATUS_DOT: Record<ProviderHealthStatus, string> = {
  online:   "bg-emerald-500",
  degraded: "bg-amber-500",
  offline:  "bg-red-500",
  unknown:  "bg-[#CBD5E1]",
};

function LastSyncLabel({ date, neverLabel }: { date: Date | null; neverLabel: string }) {
  if (!date) return <span className="text-[#94A3B8]">{neverLabel}</span>;
  return (
    <span className="font-mono text-[10px] text-[#475569]" suppressHydrationWarning>
      {date.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}

export function SystemStatusWidget({ state, presentationMode }: Props) {
  const t = useT();
  const { providerStatus, totalProcessed, lastRefreshed } = state;

  const online  = useMemo(() => providerStatus.filter((p) => p.status === "online").length, [providerStatus]);
  const offline = useMemo(() => providerStatus.filter((p) => p.status === "offline").length, [providerStatus]);

  const overallDot = offline > 0 ? "amber" : online === 0 ? "red" : "green";

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.systemStatus")}
      icon={<Cpu className="h-4 w-4" />}
      statusDot={overallDot}
      presentationMode={presentationMode}
      className="h-full"
    >
      <div className="flex h-full flex-col gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("app.pages.missionControl.widgets.statProviders"), value: `${online}/${providerStatus.length}`, icon: "🔌" },
            { label: t("app.pages.missionControl.widgets.statEvents"), value: totalProcessed.toString(), icon: "📊" },
            { label: t("app.pages.missionControl.widgets.statCountries"), value: state.countriesCovered.toString(), icon: "🌍" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-center">
              <div className="text-sm">{icon}</div>
              <div className={`font-mono font-bold text-[#0F172A] ${presentationMode ? "text-sm" : "text-xs"}`}>{value}</div>
              <div className="text-[8px] uppercase tracking-wider text-[#64748B]">{label}</div>
            </div>
          ))}
        </div>

        <div className="panel-scroll flex-1 space-y-1">
          {providerStatus.slice(0, 8).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-[#F8FAFC]"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[p.status]}`} />
              <span className={`min-w-0 flex-1 truncate text-[#475569] ${presentationMode ? "text-xs" : "text-[10px]"}`}>
                {p.label}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-[#94A3B8]">{p.eventCount}</span>
              <span className="shrink-0">{STATUS_ICONS[p.status]}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-1.5">
          <Database className="h-3 w-3 shrink-0 text-[#94A3B8]" />
          <span className="flex-1 text-[9px] text-[#64748B]">{t("app.pages.missionControl.widgets.lastSync")}</span>
          <LastSyncLabel date={lastRefreshed} neverLabel={t("app.pages.missionControl.widgets.never")} />
        </div>
      </div>
    </WidgetContainer>
  );
}
