/**
 * CrisisBanner — Live Crisis Mode indicator for Mission Control.
 *
 * Appears automatically (without interrupting the user) when the Alert
 * Engine detects an active crisis at "high" level or above. Designed to be
 * unobtrusive: it slides in, never blocks interaction, and can be dismissed
 * per-session (reappears if a NEW or more severe crisis is detected).
 */
import { useState, useEffect } from "react";
import { AlertOctagon, X, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { CrisisSituation } from "../types";
import { ALERT_LEVEL_COLORS, CRISIS_PATTERN_LABELS } from "../types";
import { useT } from "@/i18n";

interface Props {
  crisis: CrisisSituation | null;
  onNavigateToCountry?: (country: string) => void;
}

export function CrisisBanner({ crisis, onNavigateToCountry }: Props) {
  const t = useT();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (crisis && dismissedId && crisis.id !== dismissedId) {
      // new crisis detected — allow it to show again
    }
  }, [crisis, dismissedId]);

  if (!crisis || crisis.id === dismissedId) return null;

  const color = ALERT_LEVEL_COLORS[crisis.level];
  const patternLabel = CRISIS_PATTERN_LABELS[crisis.pattern];

  return (
    <div
      className="flex shrink-0 animate-fade-in items-center gap-3 border-b px-4 py-2 backdrop-blur-xl"
      style={{
        background: `linear-gradient(90deg, ${color}18, ${color}08)`,
        borderColor: `${color}35`,
      }}
      role="alert"
    >
      <AlertOctagon className="h-4 w-4 shrink-0 animate-pulse" style={{ color }} />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color, background: `${color}18` }}
        >
          {crisis.level}
        </span>
        <span className="truncate text-xs font-semibold text-foreground">{crisis.title}</span>
        <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
          {patternLabel} · {crisis.reason}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {crisis.affectedCountries[0] && onNavigateToCountry && (
          <button
            onClick={() => onNavigateToCountry(crisis.affectedCountries[0])}
            className="hidden items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary md:flex"
          >
            {crisis.affectedCountries[0]}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => void navigate({ to: "/alert-center" })}
          className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
          style={{ color, borderColor: `${color}45` }}
        >
          {t("app.pages.alertCenter.investigate")}
        </button>
        <button
          onClick={() => setDismissedId(crisis.id)}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("app.pages.alertCenter.dismissCrisis")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
