/**
 * GlobalStabilityPanel — "Global Intelligence Status" dashboard widget.
 * Layout follows an 8px spacing system for consistent alignment.
 */
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Activity, Globe2 } from "lucide-react";
import { useT } from "@/i18n";
import type { IntelligenceItem, Earthquake } from "@/types";
import { DataBadge } from "@/components/ui/DataBadge";

interface Props {
  intel: IntelligenceItem[];
  quakes: Earthquake[];
  loading?: boolean;
}

type StabilityTier = "stable" | "elevated" | "highAlert" | "critical";

interface StabilitySummary {
  tier: StabilityTier;
  score: number;
  criticalCount: number;
  highCount: number;
  dominantDomain: string;
  badgeVariant: "live" | "neutral" | "demo" | "error";
  Icon: React.ElementType;
  iconColor: string;
  description: string;
}

function computeStability(intel: IntelligenceItem[], quakes: Earthquake[]): StabilitySummary {
  const criticalCount = intel.filter((i) => i.severity === "critical").length;
  const highCount = intel.filter((i) => i.severity === "high").length;
  const quakeCritical = quakes.filter((q) => q.magnitude >= 6).length;

  const threatScore = Math.min(100, criticalCount * 4 + highCount * 2 + quakeCritical * 3);
  const stabilityScore = Math.max(0, 100 - threatScore);

  const domainCounts: Record<string, number> = {};
  for (const i of intel) {
    const cat = i.category ?? "general";
    domainCounts[cat] = (domainCounts[cat] ?? 0) + 1;
  }
  const dominantDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";

  if (stabilityScore >= 75) {
    return {
      tier: "stable",
      score: stabilityScore,
      criticalCount,
      highCount,
      dominantDomain,
      badgeVariant: "live",
      Icon: ShieldCheck,
      iconColor: "text-emerald-500",
      description: "No major active threats detected across monitored sectors.",
    };
  }
  if (stabilityScore >= 50) {
    return {
      tier: "elevated",
      score: stabilityScore,
      criticalCount,
      highCount,
      dominantDomain,
      badgeVariant: "neutral",
      Icon: ShieldAlert,
      iconColor: "text-amber-500",
      description: `${highCount} high-priority events active. Monitoring recommended.`,
    };
  }
  if (stabilityScore >= 25) {
    return {
      tier: "highAlert",
      score: stabilityScore,
      criticalCount,
      highCount,
      dominantDomain,
      badgeVariant: "error",
      Icon: ShieldAlert,
      iconColor: "text-orange-500",
      description: `${criticalCount} critical + ${highCount} high events. Escalation possible.`,
    };
  }
  return {
    tier: "critical",
    score: stabilityScore,
    criticalCount,
    highCount,
    dominantDomain,
    badgeVariant: "error",
    Icon: ShieldX,
    iconColor: "text-rose-500",
    description: `${criticalCount} critical incidents active. Immediate attention required.`,
  };
}

function domainLabel(d: string): string {
  const map: Record<string, string> = {
    military: "Military",
    politics: "Geopolitics",
    geopolitics: "Geopolitics",
    economy: "Economic",
    cyber: "Cyber",
    technology: "Technology",
    disaster: "Disaster",
    climate: "Climate",
    health: "Health",
    general: "General",
  };
  return map[d] ?? d.charAt(0).toUpperCase() + d.slice(1);
}

function scoreBarClass(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-rose-500";
}

function scoreTextClass(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

export function GlobalStabilityPanel({ intel, quakes, loading }: Props) {
  const t = useT();
  const summary = useMemo(
    () => (loading ? null : computeStability(intel, quakes)),
    [intel, quakes, loading],
  );

  const [updatedTime, setUpdatedTime] = useState("");
  useEffect(() => {
    setUpdatedTime(new Date().toLocaleTimeString());
  }, [summary]);

  if (loading || !summary) {
    return <div className="h-24 animate-pulse rounded-xl border border-border/40 bg-secondary/20" />;
  }

  const {
    Icon,
    iconColor,
    tier,
    score,
    criticalCount,
    highCount,
    dominantDomain,
    badgeVariant,
    description,
  } = summary;

  return (
    <section
      className="glass-card flex flex-col gap-4 p-4"
      aria-label={t("app.pages.dashboard.stabilityPanel.title")}
    >
      {/* Header: icon + title + badge */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
          <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold leading-5 text-foreground">
              {t("app.pages.dashboard.stabilityPanel.title")}
            </h2>
            <DataBadge variant={badgeVariant}>{t(`app.ui.stability.${tier}`)}</DataBadge>
          </div>
          <p className="text-xs leading-4 text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>

      {/* Metrics — equal-height grid, 8px gaps */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label={t("app.ui.stability.stable")}
          value={`${score}%`}
          color={scoreTextClass(score)}
        />
        <Metric
          label={t("app.ui.severity.critical")}
          value={criticalCount}
          color="text-rose-600"
        />
        <Metric
          label={t("app.ui.severity.high")}
          value={highCount}
          color="text-amber-600"
        />
        <Metric
          label={t("app.pages.dashboard.stabilityPanel.topDomain")}
          value={domainLabel(dominantDomain)}
          color="text-sky-600"
        />
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("app.pages.dashboard.statusBar.globalStabilityIndex", {
              tier: t(`app.ui.stability.${tier}`),
            })}
          </span>
          <span className={`text-[10px] font-bold tabular-nums ${scoreTextClass(score)}`}>
            {score}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("app.pages.dashboard.stabilityPanel.title")}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBarClass(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("app.pages.dashboard.stabilityPanel.eventsMonitored", { count: intel.length })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("app.pages.dashboard.stabilityPanel.seismicEvents", { count: quakes.length })}
        </span>
        <span suppressHydrationWarning className="ml-auto tabular-nums">
          {updatedTime ? `${t("app.ui.updated")} ${updatedTime}` : ""}
        </span>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex min-h-[56px] flex-col justify-center gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className={`truncate text-base font-bold leading-5 tabular-nums ${color}`}>{value}</div>
      <div className="truncate text-[9px] font-medium uppercase leading-3 tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
