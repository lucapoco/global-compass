export type MapFilterKey = "earthquake" | "weather" | "country" | "alert" | "highOnly";

interface Props {
  value: Record<MapFilterKey, boolean>;
  onChange: (k: MapFilterKey, v: boolean) => void;
}

const ITEMS: { k: MapFilterKey; label: string }[] = [
  { k: "earthquake", label: "Earthquakes" },
  { k: "weather", label: "Weather" },
  { k: "country", label: "Capitals" },
  { k: "alert", label: "Saved alerts" },
  { k: "highOnly", label: "High severity only" },
];

export function MapFilters({ value, onChange }: Props) {
  return (
    <div className="glass-card flex flex-wrap gap-2 p-3">
      {ITEMS.map((i) => (
        <button
          key={i.k}
          onClick={() => onChange(i.k, !value[i.k])}
          className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
            value[i.k]
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
