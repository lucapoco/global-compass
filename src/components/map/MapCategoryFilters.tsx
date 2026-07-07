import type { GlobalEventCategory } from "@/domain/models/GlobalEvent";
import { MAP_CATEGORIES } from "@/utils/filterEvents";

interface Props {
  selected: Set<GlobalEventCategory>;
  counts: Map<GlobalEventCategory, number>;
  onToggle: (c: GlobalEventCategory) => void;
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

/** Every category button here is wired to a real EventEngine filter — no decorative-only chips. */
export function MapCategoryFilters({ selected, counts, onToggle, onClear }: Props) {
  const allActive = selected.size === 0;
  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2" title="Filter map events by category.">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Category</span>
      <button type="button" onClick={onClear} className={chip(allActive, false)}>
        All
      </button>
      {MAP_CATEGORIES.map((c) => {
        const n = counts.get(c.id) ?? 0;
        return (
          <button key={c.id} type="button" onClick={() => onToggle(c.id)} className={chip(selected.has(c.id), n === 0)}>
            {c.label}
            {n > 0 ? ` (${n})` : ""}
          </button>
        );
      })}
    </div>
  );
}
