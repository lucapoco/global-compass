/**
 * RegionalActivityWidget — Regional stability comparison (light theme).
 */
import { useMemo } from "react";
import { Globe } from "lucide-react";
import { WidgetContainer } from "../components/WidgetContainer";
import type { MissionControlState } from "../types";
import { computeRegionalStabilityIndex } from "@/domain/decision/stability/stabilityEngine";
import { STABILITY_TIER_COLORS } from "@/domain/decision/models/StabilityIndex";
import { useT } from "@/i18n";

interface Props {
  state: MissionControlState;
  presentationMode?: boolean;
}

export function RegionalActivityWidget({ state, presentationMode }: Props) {
  const t = useT();
  const rsi = useMemo(
    () => computeRegionalStabilityIndex(state.events),
    [state.events],
  );

  const sorted = [...rsi.entries].sort((a, b) => a.score - b.score);

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.regional")}
      icon={<Globe className="h-4 w-4" />}
      statusDot="blue"
      presentationMode={presentationMode}
      className="h-full"
    >
      <div className="panel-scroll h-full space-y-2.5">
        {sorted.map((entry) => {
          const color = STABILITY_TIER_COLORS[entry.tier] ?? "#F59E0B";
          return (
            <div key={entry.region}>
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className={`truncate font-medium text-[#0F172A] ${presentationMode ? "text-xs" : "text-[11px]"}`}>
                  {entry.region}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[9px] text-[#64748B]">{entry.eventCount} ev</span>
                  <span className="font-mono text-[10px] font-bold" style={{ color }}>
                    {entry.score}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${entry.score}%`, background: color }}
                />
              </div>
            </div>
          );
        })}

        {rsi.mostStable && rsi.leastStable && (
          <div className="mt-auto flex gap-2 border-t border-[#E2E8F0] pt-2">
            <div className="flex-1 text-center">
              <div className="text-[8px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.mostStable")}</div>
              <div className="truncate text-[10px] font-medium text-emerald-700">{rsi.mostStable.region}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[8px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.mostTense")}</div>
              <div className="truncate text-[10px] font-medium text-red-600">{rsi.leastStable.region}</div>
            </div>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
