import type { EventLayer, EventSeverity } from "@/types";

interface Props {
  enabledLayers: EventLayer[];
  onToggleLayer: (k: EventLayer) => void;
  selectedSeverity: EventSeverity | "all";
  onSeverity: (s: EventSeverity | "all") => void;
}

const LAYERS: { k: EventLayer; label: string }[] = [
  { k: "earthquakes", label: "Earthquakes" },
  { k: "intelligence", label: "Intelligence" },
  { k: "saved_alerts", label: "Saved alerts" },
  { k: "weather", label: "Weather" },
  { k: "capitals", label: "Capitals" },
];

const SEVS: { k: EventSeverity | "all"; label: string }[] = [
  { k: "all", label: "All" },
  { k: "critical", label: "Critical" },
  { k: "high", label: "High" },
  { k: "medium", label: "Medium" },
  { k: "low", label: "Low" },
];

function chip(active: boolean) {
  return `rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapFilters({ enabledLayers, onToggleLayer, selectedSeverity, onSeverity }: Props) {
  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Layers</span>
        {LAYERS.map((l) => (
          <button
            key={l.k}
            type="button"
            onClick={() => onToggleLayer(l.k)}
            className={chip(enabledLayers.includes(l.k))}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Severity</span>
        {SEVS.map((s) => (
          <button
            key={s.k}
            type="button"
            onClick={() => onSeverity(s.k)}
            className={chip(selectedSeverity === s.k)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
