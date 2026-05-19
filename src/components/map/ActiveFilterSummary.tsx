import { X } from "lucide-react";
import type { EventCategory, EventLayer, EventSeverity } from "@/types";

interface Props {
  categories: Set<EventCategory>;
  selectedSeverity: EventSeverity | "all";
  highOnly: boolean;
  searchQuery: string;
  enabledLayers: EventLayer[];
  onRemoveCategory: (c: EventCategory) => void;
  onClearSeverity: () => void;
  onClearHighOnly: () => void;
  onClearSearch: () => void;
  onEnableLayer: (l: EventLayer) => void;
  onClearAll: () => void;
}

const CAT_LABELS: Partial<Record<EventCategory, string>> = { technology: "Tech" };
const LAYER_LABELS: Record<EventLayer, string> = {
  earthquakes: "Earthquakes",
  intelligence: "Intelligence",
  saved_alerts: "Saved alerts",
  weather: "Weather",
  capitals: "Capitals",
};

const ALL: EventLayer[] = ["earthquakes", "intelligence", "saved_alerts", "weather", "capitals"];

export function ActiveFilterSummary({
  categories,
  selectedSeverity,
  highOnly,
  searchQuery,
  enabledLayers,
  onRemoveCategory,
  onClearSeverity,
  onClearHighOnly,
  onClearSearch,
  onEnableLayer,
  onClearAll,
}: Props) {
  const chips: React.ReactNode[] = [];

  for (const c of categories) {
    chips.push(
      <button
        key={`cat-${c}`}
        type="button"
        onClick={() => onRemoveCategory(c)}
        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
      >
        {CAT_LABELS[c] ?? c} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (selectedSeverity !== "all") {
    chips.push(
      <button
        key="sev"
        type="button"
        onClick={onClearSeverity}
        className="inline-flex items-center gap-1 rounded-md border border-amber-glow/40 bg-amber-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-glow"
      >
        Severity: {selectedSeverity} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (highOnly) {
    chips.push(
      <button
        key="hi"
        type="button"
        onClick={onClearHighOnly}
        className="inline-flex items-center gap-1 rounded-md border border-rose-glow/40 bg-rose-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-glow"
      >
        High severity only <X className="h-3 w-3" />
      </button>,
    );
  }
  if (searchQuery.trim()) {
    chips.push(
      <button
        key="q"
        type="button"
        onClick={onClearSearch}
        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        Search: &quot;{searchQuery.trim()}&quot; <X className="h-3 w-3" />
      </button>,
    );
  }
  for (const L of ALL) {
    if (!enabledLayers.includes(L)) {
      chips.push(
        <button
          key={`off-${L}`}
          type="button"
          onClick={() => onEnableLayer(L)}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
        >
          Layer off: {LAYER_LABELS[L]} <X className="h-3 w-3" />
        </button>,
      );
    }
  }

  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Active filters</span>
      {chips.length === 0 ? (
        <span className="text-[10px] text-muted-foreground">All events visible</span>
      ) : (
        <>
          {chips}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
