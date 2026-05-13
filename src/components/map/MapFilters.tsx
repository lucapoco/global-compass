import type { IntelligenceCategory } from "@/types";

export type LayerKey = "earthquake" | "weather" | "country" | "alert" | "intelligence";
export type SeverityKey = "all" | "Critical" | "High" | "Medium" | "Low";
export type CategoryKey = IntelligenceCategory | "earthquake" | "weather" | "all";

interface Props {
  layers: Record<LayerKey, boolean>;
  onToggleLayer: (k: LayerKey) => void;
  severity: SeverityKey;
  onSeverity: (s: SeverityKey) => void;
}

const LAYERS: { k: LayerKey; label: string }[] = [
  { k: "earthquake", label: "Earthquakes" },
  { k: "intelligence", label: "Intelligence" },
  { k: "alert", label: "Saved alerts" },
  { k: "weather", label: "Weather" },
  { k: "country", label: "Capitals" },
];

const SEVS: SeverityKey[] = ["all", "Critical", "High", "Medium", "Low"];

function chip(active: boolean) {
  return `rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapFilters({ layers, onToggleLayer, severity, onSeverity }: Props) {
  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Layers</span>
        {LAYERS.map((l) => (
          <button key={l.k} onClick={() => onToggleLayer(l.k)} className={chip(layers[l.k])}>{l.label}</button>
        ))}
      </div>
      <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
        <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Severity</span>
        {SEVS.map((s) => (
          <button key={s} onClick={() => onSeverity(s)} className={chip(severity === s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
