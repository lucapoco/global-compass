/**
 * CrisisCard — Displays a detected CrisisSituation with its AI briefing (light theme).
 */
import { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { CrisisSituation, CrisisBriefing } from "../types";
import { ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS, CRISIS_PATTERN_LABELS } from "../types";
import { useT } from "@/i18n";

interface Props {
  crisis: CrisisSituation;
  briefing?: CrisisBriefing;
}

export function CrisisCard({ crisis, briefing }: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const color = ALERT_LEVEL_COLORS[crisis.level];

  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      style={{ borderColor: `${color}40`, background: `linear-gradient(135deg, ${color}12, var(--color-card))` }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/30"
      >
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ color, background: `${color}18` }}
            >
              {ALERT_LEVEL_LABELS[crisis.level]}
            </span>
            <span className="text-[10px] text-muted-foreground">{CRISIS_PATTERN_LABELS[crisis.pattern]}</span>
          </div>
          <div className="text-sm font-semibold text-foreground">{crisis.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{crisis.reason}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold" style={{ color }}>{crisis.riskScore}</div>
          <div className="text-[8px] uppercase tracking-wide text-muted-foreground">{t("app.ui.risk")}</div>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && briefing && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> {t("app.pages.alertCenter.aiCrisisBriefing")}
          </div>
          <p className="text-xs leading-relaxed text-foreground/80">{briefing.situationOverview}</p>

          {briefing.supportingEvidence.length > 0 && (
            <div>
              <div className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                {t("app.pages.alertCenter.supportingEvidence")}
              </div>
              <ul className="space-y-1">
                {briefing.supportingEvidence.map((ev, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-foreground/70">
                    <span className="text-muted-foreground">•</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {briefing.recommendedInvestigationAreas.length > 0 && (
            <div>
              <div className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                {t("app.pages.alertCenter.recommendedInvestigation")}
              </div>
              <ul className="space-y-1">
                {briefing.recommendedInvestigationAreas.map((area, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-foreground/70">
                    <span className="text-primary">→</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
            <span>
              {t("app.pages.alertCenter.trend")}:{" "}
              <span className="text-foreground/80">{briefing.currentTrend.replace(/_/g, " ")}</span>
            </span>
            <span>
              {t("app.ui.confidence")}:{" "}
              <span className="text-foreground/80">{briefing.confidence}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
