/**
 * Mission Control — Global Pulse Operational Command Center
 *
 * This is the flagship presentation interface of Global Pulse.
 * Designed for large displays, competition demonstrations, and
 * continuous real-time monitoring.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAYOUT (normal mode)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  HEADER  (status · GSI · event counters · clock · controls) │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  QUICK COMMANDS BAR                                         │
 *  ├──────────────┬──────────────────────────┬───────────────────┤
 *  │  THREAT      │                          │  AI BRIEFING      │
 *  │  PANEL       │   LIVE MEDIA CENTER      │                   │
 *  │  (GSI gauge  │   (Sky News / BBC)        │  KEY FINDINGS     │
 *  │  + risk map) │                          │                   │
 *  │              ├──────────────────────────┤  REGIONAL         │
 *  │  CRITICAL    │   REGIONAL + SYSTEM      │  ACTIVITY         │
 *  │  EVENTS FEED │   STATUS                 │                   │
 *  └──────────────┴──────────────────────────┴───────────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PRESENTATION MODE
 * ─────────────────────────────────────────────────────────────────────────
 * • Larger typography (scale 1.15×)
 * • Quick commands hidden
 * • Fullscreen API engaged
 * • High-contrast borders
 * • Simplified controls
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AUTO REFRESH
 * ─────────────────────────────────────────────────────────────────────────
 * • Intelligent 5-minute polling (pauses when tab is hidden)
 * • Manual refresh available at all times
 * • Countdown visible in header
 */
import { useCallback, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMissionControl } from "@/mission-control/hooks/useMissionControl";
import { useMissionControlWorkspace } from "@/mission-control/hooks/useMissionControlWorkspace";
import { useAlertCenter } from "@/alert-system/hooks/useAlertCenter";
import { CrisisBanner } from "@/alert-system/components/CrisisBanner";
import { MissionControlHeader } from "@/mission-control/components/MissionControlHeader";
import { QuickCommandsBar } from "@/mission-control/components/QuickCommandsBar";
import { ThreatPanelWidget } from "@/mission-control/widgets/ThreatPanelWidget";
import { CriticalEventsWidget } from "@/mission-control/widgets/CriticalEventsWidget";
import { LiveMediaWidget } from "@/mission-control/widgets/LiveMediaWidget";
import { AIBriefingWidget } from "@/mission-control/widgets/AIBriefingWidget";
import { RegionalActivityWidget } from "@/mission-control/widgets/RegionalActivityWidget";
import { SystemStatusWidget } from "@/mission-control/widgets/SystemStatusWidget";
import { useT } from "@/i18n";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/mission-control")({
  component: MissionControlPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function MissionControlPage() {
  const t = useT();
  const { state, refresh } = useMissionControl();
  const { presentation, setPresentation, isSynced } = useMissionControlWorkspace();
  const { bundle: alertBundle } = useAlertCenter();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Presentation mode toggle (synced for authenticated users) ───────────
  const togglePresentation = useCallback(() => {
    setPresentation((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      hideControls: !prev.enabled,
    }));
  }, [setPresentation]);

  // ── Fullscreen ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setPresentation((prev) => ({ ...prev, fullscreen: true }));
    } else {
      await document.exitFullscreen?.();
      setPresentation((prev) => ({ ...prev, fullscreen: false }));
    }
  }, [setPresentation]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setPresentation((prev) => ({ ...prev, fullscreen: false }));
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [setPresentation]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F5" || (e.key === "r" && e.ctrlKey)) {
        e.preventDefault();
        void refresh();
      }
      if (e.key === "p" && e.ctrlKey) {
        e.preventDefault();
        togglePresentation();
      }
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, togglePresentation, toggleFullscreen]);

  const pm = presentation.enabled;

  return (
    <div
      ref={containerRef}
      className="mission-control-shell flex flex-col overflow-hidden select-none bg-[#F8FAFC] panel-grid"
      style={{ fontSize: pm ? "1rem" : undefined }}
      role="main"
      aria-label={t("app.pages.missionControl.ariaMain")}
    >
      {/* ── Top header ───────────────────────────────────────────────── */}
      <MissionControlHeader
        state={state}
        presentation={presentation}
        onRefresh={() => void refresh()}
        onTogglePresentation={togglePresentation}
        onToggleFullscreen={() => void toggleFullscreen()}
      />

      {isSynced ? (
        <div className="border-b border-slate-200/80 bg-white/70 px-4 py-1 text-[10px] text-slate-500">
          {t("app.pages.missionControl.workspaceSynced")}
        </div>
      ) : null}

      {/* ── Live Crisis Mode banner — appears automatically, never blocks ─ */}
      <CrisisBanner
        crisis={alertBundle?.mostSevereCrisis ?? null}
        onNavigateToCountry={(country) => void navigate({ to: "/country/$name", params: { name: country } })}
      />

      {/* ── Quick commands ─────────────────────────────────────────────── */}
      {!presentation.hideControls && (
        <QuickCommandsBar compact={!pm} />
      )}

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className={`mission-control-grid ${pm ? "is-presentation" : ""}`}>
        {/* ── Left column ─── */}
        <div className="mc-left-col row-span-2 flex min-h-0 flex-col gap-4">
          <div className="mc-widget-slot min-h-0" style={{ flex: "0 0 58%" }}>
            <ThreatPanelWidget state={state} presentationMode={pm} />
          </div>
          <div className="mc-widget-slot min-h-0 flex-1">
            <CriticalEventsWidget state={state} presentationMode={pm} />
          </div>
        </div>

        <div className="mc-widget-slot min-h-0" style={{ flex: "0 0 62%" }}>
          <LiveMediaWidget presentationMode={pm} />
        </div>

        <div className="mc-widget-slot min-h-0" style={{ flex: "0 0 62%" }}>
          <AIBriefingWidget state={state} presentationMode={pm} />
        </div>

        <div className="mc-widget-slot grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <RegionalActivityWidget state={state} presentationMode={pm} />
          <SystemStatusWidget state={state} presentationMode={pm} />
        </div>

        <div className="mc-widget-slot min-h-0">
          <TrendingActivityPanel state={state} presentationMode={pm} />
        </div>
      </div>

      {/* ── Footer status strip ───────────────────────────────────────── */}
      <StatusFooter state={state} presentation={presentation} />
    </div>
  );
}

// ─── Trending Activity Panel (inline) ────────────────────────────────────────

import { TrendingUp } from "lucide-react";
import { WidgetContainer } from "@/mission-control/components/WidgetContainer";
import { computeCategoryBreakdown } from "@/domain/decision/analytics/analyticsService";
import { useMemo } from "react";

function TrendingActivityPanel({ state, presentationMode }: { state: import("@/mission-control/types").MissionControlState; presentationMode?: boolean }) {
  const t = useT();
  const breakdown = useMemo(() => computeCategoryBreakdown(state.events).slice(0, 7), [state.events]);

  const maxCount = breakdown[0]?.count ?? 1;

  const catColors: Record<string, string> = {
    military: "#ef4444", earthquake: "#f97316", disaster: "#f59e0b",
    geopolitics: "#8b5cf6", cyber: "#0891b2", economy: "#059669",
    weather: "#0ea5e9", health: "#db2777", general: "#6b7280",
    technology: "#7c3aed", energy: "#d97706", climate: "#0284c7",
  };

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.categoryActivity")}
      icon={<TrendingUp className="w-4 h-4" />}
      statusDot="blue"
      presentationMode={presentationMode}
      className="h-full"
    >
      <div className="panel-scroll h-full space-y-2">
        {breakdown.map((cat) => {
          const color = catColors[cat.category] ?? "#64748B";
          return (
            <div key={cat.category}>
              <div className="mb-0.5 flex items-center justify-between">
                <span className={`truncate text-[#475569] ${presentationMode ? "text-xs" : "text-[11px]"}`}>
                  {cat.label}
                </span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-[#64748B]">{cat.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(cat.count / maxCount) * 100}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}

// ─── Status Footer ────────────────────────────────────────────────────────────

function StatusFooter({ state, presentation }: { state: import("@/mission-control/types").MissionControlState; presentation: PresentationConfig }) {
  const t = useT();
  const online = state.providerStatus.filter((p) => p.status === "online").length;

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t border-[#E2E8F0] bg-white/95 px-4 py-2 text-[9px] backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="font-medium uppercase tracking-wide text-emerald-700">{t("app.pages.missionControl.operational")}</span>
      </div>
      <div className="text-[#64748B]">
        {t("app.pages.missionControl.providersOnline", { online, total: state.providerStatus.length })}
      </div>
      <div className="text-[#64748B]">
        {t("app.pages.missionControl.eventsProcessed", { count: state.totalProcessed })}
      </div>
      <div className="hidden text-[#64748B] sm:block">
        {t("app.pages.missionControl.countriesMonitored", { count: state.countriesCovered })}
      </div>
      <div className="flex-1" />
      {presentation.enabled && (
        <div className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-medium uppercase tracking-wide text-primary">
          {t("app.pages.missionControl.presentation")}
        </div>
      )}
      <div className="hidden uppercase tracking-widest text-[#94A3B8] md:block">
        {t("app.pages.missionControl.footerBrand")}
      </div>
    </footer>
  );
}
