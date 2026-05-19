import type { EventCategory } from "@/types";

const CATS: { k: EventCategory; label: string }[] = [
  { k: "geopolitics", label: "Geopolitics" },
  { k: "military", label: "Military" },
  { k: "economy", label: "Economy" },
  { k: "technology", label: "Tech" },
  { k: "energy", label: "Energy" },
  { k: "climate", label: "Climate" },
  { k: "disaster", label: "Disaster" },
  { k: "cyber", label: "Cyber" },
  { k: "health", label: "Health" },
  { k: "earthquake", label: "Earthquake" },
  { k: "weather", label: "Weather" },
  { k: "general", label: "General" },
];

interface Props {
  selected: Set<EventCategory>;
  counts: Partial<Record<EventCategory, number>>;
  onToggle: (c: EventCategory) => void;
  onClear: () => void;
}

function chip(active: boolean, muted: boolean) {
  return `rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
    active
      ? "border-primary/50 bg-primary/15 text-primary"
      : muted
        ? "border-border/40 text-muted-foreground/60 hover:text-foreground"
        : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

export function MapCategoryFilters({ selected, counts, onToggle, onClear }: Props) {
  const allActive = selected.size === 0;
  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2" title="Filter map events by category.">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Category</span>
      <button type="button" onClick={onClear} className={chip(allActive, false)}>
        All
      </button>
      {CATS.map((c) => {
        const n = counts[c.k] ?? 0;
        return (
          <button key={c.k} type="button" onClick={() => onToggle(c.k)} className={chip(selected.has(c.k), n === 0)}>
            {c.label}
            {n > 0 ? ` (${n})` : ""}
          </button>
        );
      })}
    </div>
  );
}
