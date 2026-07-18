import type { GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { LAYER_GROUPS } from "@/utils/filterEvents";
import { useT } from "@/i18n";

interface Props {
  enabledLayerGroups: string[];
  onToggleLayerGroup: (id: string) => void;
  selectedSeverities: GlobalEventSeverity[];
  onToggleSeverity: (s: GlobalEventSeverity) => void;
  minRiskScore?: number;
  onMinRiskScore: (v: number | undefined) => void;
  minConfidence?: number;
  onMinConfidence: (v: number | undefined) => void;
  verifiedOnly: boolean;
  onToggleVerifiedOnly: () => void;
  liveOnly: boolean;
  onToggleLiveOnly: () => void;
  heatmapOpacity?: number;
  onHeatmapOpacity?: (v: number) => void;
  riskIndexOpacity?: number;
  onRiskIndexOpacity?: (v: number) => void;
  showRiskIndex?: boolean;
}

const SEVS: GlobalEventSeverity[] = ["critical", "high", "medium", "low"];

const RISK_THRESHOLDS = [50, 70, 85];

function chip(active: boolean) {
  return `rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapFilters({
  enabledLayerGroups,
  onToggleLayerGroup,
  selectedSeverities,
  onToggleSeverity,
  minRiskScore,
  onMinRiskScore,
  minConfidence,
  onMinConfidence,
  verifiedOnly,
  onToggleVerifiedOnly,
  liveOnly,
  onToggleLiveOnly,
  heatmapOpacity = 0.75,
  onHeatmapOpacity,
  riskIndexOpacity = 0.7,
  onRiskIndexOpacity,
  showRiskIndex = false,
}: Props) {
  const t = useT();

  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.layers")}</span>
        {LAYER_GROUPS.map((l) => (
          <button key={l.id} type="button" onClick={() => onToggleLayerGroup(l.id)} className={chip(enabledLayerGroups.includes(l.id))}>
            {l.label}
          </button>
        ))}
      </div>
      {(onHeatmapOpacity || (showRiskIndex && onRiskIndexOpacity)) && (
        <div className="glass-card flex flex-wrap items-center gap-3 p-2">
          <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.layerOpacity")}</span>
          {onHeatmapOpacity && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {t("app.pages.map.ui.heatmap")}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={heatmapOpacity}
                onChange={(e) => onHeatmapOpacity(Number(e.target.value))}
                className="h-1 w-20 accent-primary"
                aria-label={t("app.pages.map.ui.heatmapOpacityAria")}
              />
            </label>
          )}
          {showRiskIndex && onRiskIndexOpacity && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {t("app.pages.map.ui.riskIndex")}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={riskIndexOpacity}
                onChange={(e) => onRiskIndexOpacity(Number(e.target.value))}
                className="h-1 w-20 accent-primary"
                aria-label={t("app.pages.map.ui.riskIndexOpacityAria")}
              />
            </label>
          )}
        </div>
      )}
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.severity")}</span>
        {SEVS.map((s) => (
          <button key={s} type="button" onClick={() => onToggleSeverity(s)} className={chip(selectedSeverities.includes(s))}>
            {t(`app.ui.severity.${s}`)}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border/60 sm:inline" />
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.riskMin")}</span>
        {RISK_THRESHOLDS.map((threshold) => (
          <button key={threshold} type="button" onClick={() => onMinRiskScore(minRiskScore === threshold ? undefined : threshold)} className={chip(minRiskScore === threshold)}>
            {threshold}
          </button>
        ))}
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.confidenceMin")}</span>
        {RISK_THRESHOLDS.map((threshold) => (
          <button key={threshold} type="button" onClick={() => onMinConfidence(minConfidence === threshold ? undefined : threshold)} className={chip(minConfidence === threshold)}>
            {threshold}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border/60 sm:inline" />
        <button type="button" onClick={onToggleVerifiedOnly} className={chip(verifiedOnly)}>
          {t("app.pages.map.ui.verifiedOnly")}
        </button>
        <button type="button" onClick={onToggleLiveOnly} className={chip(liveOnly)}>
          {t("app.pages.map.ui.liveOnly")}
        </button>
      </div>
    </div>
  );
}
