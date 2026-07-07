import type { GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { LAYER_GROUPS } from "@/utils/filterEvents";

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
}

const SEVS: { k: GlobalEventSeverity; label: string }[] = [
  { k: "critical", label: "Critical" },
  { k: "high", label: "High" },
  { k: "medium", label: "Medium" },
  { k: "low", label: "Low" },
];

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
}: Props) {
  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Layers</span>
        {LAYER_GROUPS.map((l) => (
          <button key={l.id} type="button" onClick={() => onToggleLayerGroup(l.id)} className={chip(enabledLayerGroups.includes(l.id))}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Severity</span>
        {SEVS.map((s) => (
          <button key={s.k} type="button" onClick={() => onToggleSeverity(s.k)} className={chip(selectedSeverities.includes(s.k))}>
            {s.label}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border/60 sm:inline" />
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Risk ≥</span>
        {RISK_THRESHOLDS.map((t) => (
          <button key={t} type="button" onClick={() => onMinRiskScore(minRiskScore === t ? undefined : t)} className={chip(minRiskScore === t)}>
            {t}
          </button>
        ))}
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Confidence ≥</span>
        {RISK_THRESHOLDS.map((t) => (
          <button key={t} type="button" onClick={() => onMinConfidence(minConfidence === t ? undefined : t)} className={chip(minConfidence === t)}>
            {t}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border/60 sm:inline" />
        <button type="button" onClick={onToggleVerifiedOnly} className={chip(verifiedOnly)}>
          Verified only
        </button>
        <button type="button" onClick={onToggleLiveOnly} className={chip(liveOnly)}>
          Live only
        </button>
      </div>
    </div>
  );
}
