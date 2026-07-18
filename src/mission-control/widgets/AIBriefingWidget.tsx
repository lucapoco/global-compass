/**
 * AIBriefingWidget — AI executive intelligence briefing (light theme).
 */
import { Sparkles, Clock, CheckCircle } from "lucide-react";
import { WidgetContainer } from "../components/WidgetContainer";
import type { MissionControlState } from "../types";
import { useT } from "@/i18n";

interface Props {
  state: MissionControlState;
  presentationMode?: boolean;
}

export function AIBriefingWidget({ state, presentationMode }: Props) {
  const t = useT();
  const { summary, gsi, loadState, lastRefreshed } = state;

  const loading = loadState === "loading";

  const timeLabel = lastRefreshed
    ? lastRefreshed.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
    : "—";

  const tier = gsi?.tier ?? "watchful";
  const tierColors: Record<string, string> = {
    stable: "#22C55E", watchful: "#84CC16", elevated: "#F59E0B",
    tense: "#F97316", critical: "#EF4444", emergency: "#991B1B",
  };
  const tierColor = tierColors[tier] ?? "#F59E0B";

  if (!summary) {
    return (
      <WidgetContainer
        title={t("app.pages.missionControl.widgets.aiBriefing")}
        icon={<Sparkles className="h-4 w-4" />}
        loading={loading}
        presentationMode={presentationMode}
        className="h-full"
      >
        <div />
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.aiBriefing")}
      icon={<Sparkles className="h-4 w-4" />}
      statusDot="blue"
      presentationMode={presentationMode}
      className="h-full"
      actions={
        <div className="flex items-center gap-1 text-[9px] text-[#64748B]">
          <Clock className="h-2.5 w-2.5" />
          <span suppressHydrationWarning>{timeLabel}</span>
        </div>
      }
    >
      <div className="panel-scroll flex h-full flex-col gap-2.5">
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: `${tierColor}35`, background: `${tierColor}10` }}
        >
          <div className={`font-bold leading-tight text-[#0F172A] ${presentationMode ? "text-sm" : "text-xs"}`}>
            {summary.headline}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ color: tierColor, borderColor: `${tierColor}40`, background: `${tierColor}12` }}
            >
              {summary.stabilityScore}/100
            </span>
            <span className="text-[9px] text-[#64748B]">
              {t("app.pages.missionControl.widgets.confidence")}: {summary.confidence}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {summary.body.map((para, i) => (
            <p
              key={i}
              className={`leading-relaxed text-[#475569] ${presentationMode ? "text-xs" : "text-[11px]"}`}
            >
              {para}
            </p>
          ))}
        </div>

        {summary.keyFindings.length > 0 && (
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.keyFindings")}</div>
            <div className="space-y-1.5">
              {summary.keyFindings.slice(0, 5).map((finding, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-primary" />
                  <span className={`text-[#334155] ${presentationMode ? "text-xs" : "text-[10px]"}`}>
                    {finding}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[#E2E8F0] pt-1.5 text-[9px] text-[#94A3B8]">
          Data: {summary.dataFromLabel} · {summary.eventCount} events analyzed
        </div>
      </div>
    </WidgetContainer>
  );
}
