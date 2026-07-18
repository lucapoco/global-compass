/**
 * MissionControlHeader — Top operational header bar (light theme).
 */
import { useState, useEffect } from "react";
import { Maximize2, Minimize2, Presentation, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { useT } from "@/i18n";
import type { MissionControlState, PresentationConfig } from "../types";

interface Props {
  state: MissionControlState;
  presentation: PresentationConfig;
  onRefresh: () => void;
  onTogglePresentation: () => void;
  onToggleFullscreen: () => void;
}

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{time}</span>;
}

function LiveDate() {
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
  }, []);
  return <span suppressHydrationWarning>{date}</span>;
}

const TIER_COLOR: Record<string, string> = {
  stable:    "text-emerald-700 border-emerald-200 bg-emerald-50",
  watchful:  "text-lime-700 border-lime-200 bg-lime-50",
  elevated:  "text-amber-700 border-amber-200 bg-amber-50",
  tense:     "text-orange-700 border-orange-200 bg-orange-50",
  critical:  "text-red-700 border-red-200 bg-red-50",
  emergency: "text-red-800 border-red-300 bg-red-100 animate-pulse",
};

export function MissionControlHeader({ state, presentation, onRefresh, onTogglePresentation, onToggleFullscreen }: Props) {
  const t = useT();
  const { events, criticalEvents, gsi, loadState, nextRefreshIn } = state;
  const tier = gsi?.tier ?? "watchful";
  const tierLabel = gsi?.tierLabel ?? t("app.pages.missionControl.loading");
  const gsiScore = gsi?.score ?? "—";

  const critCount = criticalEvents.length;
  const tierColorClass = TIER_COLOR[tier] ?? TIER_COLOR.elevated;

  return (
    <header className="z-20 flex shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="flex shrink-0 items-center">
        <BrandLogo
          variant="navbar"
          theme="light"
          size={presentation.enabled ? 46 : 44}
          wordmarkAlways
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
        <span className="live-dot" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{t("app.pages.missionControl.live")}</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4 lg:gap-6">
        <div className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${tierColorClass}`}>
          <span>GSI</span>
          <span className="font-mono">{gsiScore}/100</span>
          <span className="text-[#64748B]">·</span>
          <span>{tierLabel}</span>
        </div>

        <div className="hidden shrink-0 items-center gap-4 text-xs sm:flex">
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-[#0F172A]">{events.length}</div>
            <div className="text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.events")}</div>
          </div>
          <div className="h-6 w-px bg-[#E2E8F0]" />
          {critCount > 0 && (
            <>
              <div className="text-center">
                <div className="font-mono text-sm font-bold text-red-600">{critCount}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.critical")}</div>
              </div>
              <div className="h-6 w-px bg-[#E2E8F0]" />
            </>
          )}
          <div className="text-center">
            <div className="font-mono text-sm font-bold text-[#0F172A]">{state.countriesCovered}</div>
            <div className="text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.countries")}</div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 lg:gap-4">
        <div className="hidden text-center sm:block">
          <div className={`font-mono font-bold text-[#0F172A] ${presentation.enabled ? "text-lg" : "text-sm"}`}>
            <LiveClock />
          </div>
          <div className="text-[9px] text-[#64748B]">
            <LiveDate />
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
          <RefreshCw className={`h-3 w-3 ${loadState === "loading" ? "animate-spin text-primary" : ""}`} />
          <span className="font-mono">{nextRefreshIn}s</span>
        </div>
      </div>

      {!presentation.hideControls && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={loadState === "loading"}
            className="rounded-lg p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-primary disabled:opacity-30"
            title={t("app.pages.missionControl.forceRefresh")}
            aria-label={t("app.pages.missionControl.forceRefresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadState === "loading" ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onTogglePresentation}
            className={`rounded-lg p-1.5 transition-colors ${
              presentation.enabled
                ? "bg-primary/10 text-primary"
                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-primary"
            }`}
            title={t("app.pages.missionControl.presentationMode")}
            aria-label={t("app.pages.missionControl.presentationMode")}
          >
            <Presentation className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggleFullscreen}
            className="rounded-lg p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-primary"
            title={t("app.pages.missionControl.toggleFullscreen")}
            aria-label={t("app.pages.missionControl.toggleFullscreen")}
          >
            {presentation.fullscreen
              ? <Minimize2 className="h-3.5 w-3.5" />
              : <Maximize2 className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      )}
    </header>
  );
}
