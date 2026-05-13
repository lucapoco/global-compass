import { X } from "lucide-react";
import type { EventCategory } from "@/utils/filterEvents";
import type { SeverityKey } from "@/components/map/MapFilters";

interface Props {
  categories: Set<EventCategory>;
  severity: SeverityKey;
  highOnly: boolean;
  search: string;
  onRemoveCategory: (c: EventCategory) => void;
  onClearSeverity: () => void;
  onClearHighOnly: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

const LABELS: Record<string, string> = {
  technology: "Tech",
};

export function ActiveFilterSummary({
  categories, severity, highOnly, search,
  onRemoveCategory, onClearSeverity, onClearHighOnly, onClearSearch, onClearAll,
}: Props) {
  const chips: React.ReactNode[] = [];

  for (const c of categories) {
    chips.push(
      <button key={`cat-${c}`} onClick={() => onRemoveCategory(c)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
        {LABELS[c] ?? c} <X className="h-3 w-3" />
      </button>
    );
  }
  if (severity !== "all") chips.push(
    <button key="sev" onClick={onClearSeverity} className="inline-flex items-center gap-1 rounded-md border border-amber-glow/40 bg-amber-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-glow">
      Severity: {severity} <X className="h-3 w-3" />
    </button>
  );
  if (highOnly) chips.push(
    <button key="hi" onClick={onClearHighOnly} className="inline-flex items-center gap-1 rounded-md border border-rose-glow/40 bg-rose-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-glow">
      High severity only <X className="h-3 w-3" />
    </button>
  );
  if (search.trim()) chips.push(
    <button key="q" onClick={onClearSearch} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      Search: "{search.trim()}" <X className="h-3 w-3" />
    </button>
  );

  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Active filters</span>
      {chips.length === 0 ? (
        <span className="text-[10px] text-muted-foreground">All events visible</span>
      ) : (
        <>
          {chips}
          <button onClick={onClearAll} className="ml-auto rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
