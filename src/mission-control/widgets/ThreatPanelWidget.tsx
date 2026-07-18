/**
 * ThreatPanelWidget — Global threat overview panel (light theme).
 */
import { Shield } from "lucide-react";
import { WidgetContainer } from "../components/WidgetContainer";
import type { MissionControlState } from "../types";
import { STABILITY_TIER_COLORS } from "@/domain/decision/models/StabilityIndex";
import { computeTopRiskCountries } from "@/domain/decision/analytics/analyticsService";
import { useMemo } from "react";
import { useT } from "@/i18n";

interface Props {
  state: MissionControlState;
  presentationMode?: boolean;
}

function GSIGauge({ score, tier, color }: { score: number; tier: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#E2E8F0" strokeWidth="8" />
          <circle
            cx="48" cy="48" r="40" fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color }}>{score}</span>
          <span className="-mt-0.5 text-[9px] uppercase tracking-widest text-[#64748B]">/ 100</span>
        </div>
      </div>
      <div
        className="rounded-full border px-2 py-0.5 text-xs font-semibold"
        style={{ color, borderColor: `${color}40`, background: `${color}12` }}
      >
        {tier}
      </div>
    </div>
  );
}

export function ThreatPanelWidget({ state, presentationMode }: Props) {
  const t = useT();
  const { gsi, events } = state;

  const topCountries = useMemo(() => computeTopRiskCountries(events, 5), [events]);

  const score = gsi?.score ?? 50;
  const tier = gsi?.tierLabel ?? t("app.pages.missionControl.loading");
  const color = gsi ? STABILITY_TIER_COLORS[gsi.tier] : "#F59E0B";
  const confidence = gsi?.confidence.score ?? 0;
  const topFactors = gsi?.topDrivers ?? [];

  const critical = events.filter((e) => e.severity === "critical").length;
  const high      = events.filter((e) => e.severity === "high").length;
  const medium    = events.filter((e) => e.severity === "medium").length;
  const low       = events.filter((e) => e.severity === "low").length;
  const total     = events.length || 1;

  return (
    <WidgetContainer
      title={t("app.pages.missionControl.widgets.threatTitle")}
      icon={<Shield className="h-4 w-4" />}
      statusDot={score >= 75 ? "green" : score >= 50 ? "amber" : "red"}
      presentationMode={presentationMode}
      className="h-full"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-center gap-4 pt-1">
          <GSIGauge score={score} tier={tier} color={color} />
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] text-[#64748B]">{t("app.pages.missionControl.widgets.confidence")}</div>
            <div className="font-mono text-lg font-black text-[#0F172A]">{confidence}%</div>
            <div className="text-[10px] text-[#64748B]">{t("app.pages.missionControl.widgets.providers")}</div>
            <div className="text-xs font-semibold text-[#334155]">
              {gsi?.confidence.activeProviders.length ?? 0} {t("app.pages.missionControl.widgets.active")}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.eventSeverity")}</div>
          <div className="flex h-2 overflow-hidden rounded-full gap-0.5">
            {[
              { count: critical, color: "#EF4444" },
              { count: high,     color: "#F97316" },
              { count: medium,   color: "#F59E0B" },
              { count: low,      color: "#22C55E" },
            ].map(({ count, color: c }) => (
              <div
                key={c}
                className="transition-all duration-700"
                style={{ width: `${(count / total) * 100}%`, background: c, minWidth: count > 0 ? "4px" : 0 }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between">
            {[
              { label: "Crit", count: critical, color: "#EF4444" },
              { label: "High", count: high,     color: "#F97316" },
              { label: "Med",  count: medium,   color: "#F59E0B" },
              { label: "Low",  count: low,      color: "#22C55E" },
            ].map(({ label, count, color: c }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] font-bold" style={{ color: c }}>{count}</div>
                <div className="text-[8px] text-[#64748B]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.highestRisk")}</div>
          <div className="space-y-1.5">
            {topCountries.slice(0, 5).map((c, i) => (
              <div key={c.country} className="flex items-center gap-2">
                <span className="w-3 font-mono text-[9px] text-[#94A3B8]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-[#0F172A]">{c.country}</span>
                    <span className="font-mono text-[10px] font-bold" style={{
                      color: c.riskScore >= 70 ? "#EF4444" : c.riskScore >= 50 ? "#F97316" : "#F59E0B",
                    }}>{c.riskScore}</span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-[#E2E8F0]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${c.riskScore}%`,
                        background: c.riskScore >= 70 ? "#EF4444" : c.riskScore >= 50 ? "#F97316" : "#F59E0B",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {topFactors.length > 0 && (
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-wider text-[#64748B]">{t("app.pages.missionControl.widgets.keyFactors")}</div>
            <div className="space-y-0.5">
              {topFactors.slice(0, 2).map((f) => (
                <div key={f.id} className="truncate text-[10px] text-[#64748B]">
                  ↗ {f.evidenceSummary}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}
