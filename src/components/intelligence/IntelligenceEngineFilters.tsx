/**
 * IntelligenceEngineFilters — full filter panel for the Intelligence Engine.
 *
 * Supports: text search · multi-category · multi-severity · country ·
 *           source · min importance · live-only · time range
 */
import type { IntelligenceFilter, ExtendedCategory, EventSeverity, TimeRange } from "@/services/intelligence/types";
import { ALL_CATEGORIES, categoryLabel } from "@/services/intelligence/nlp/categoryEngine";
import { SEVERITY_META } from "@/services/intelligence/ranking/severityEngine";
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  filter: IntelligenceFilter;
  onChange: (f: IntelligenceFilter) => void;
  /** Available countries from the current event pool. */
  availableCountries?: string[];
  /** Available sources from the current event pool. */
  availableSources?: string[];
}

const SEVERITIES: EventSeverity[] = ["critical", "high", "medium", "low"];
const TIME_RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "1h", label: "Last 1h" },
  { value: "6h", label: "Last 6h" },
  { value: "24h", label: "Last 24h" },
  { value: "48h", label: "Last 48h" },
  { value: "7d", label: "Last 7d" },
];

export function IntelligenceEngineFilters({ filter, onChange, availableCountries = [], availableSources = [] }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function update(partial: Partial<IntelligenceFilter>) {
    onChange({ ...filter, ...partial });
  }

  function toggleCategory(c: ExtendedCategory) {
    const cats = filter.categories.includes(c)
      ? filter.categories.filter((x) => x !== c)
      : [...filter.categories, c];
    update({ categories: cats });
  }

  function toggleSeverity(s: EventSeverity) {
    const sevs = filter.severities.includes(s)
      ? filter.severities.filter((x) => x !== s)
      : [...filter.severities, s];
    update({ severities: sevs });
  }

  function toggleCountry(c: string) {
    const countries = filter.countries.includes(c)
      ? filter.countries.filter((x) => x !== c)
      : [...filter.countries, c];
    update({ countries });
  }

  function clearAll() {
    onChange({
      query: "", categories: [], severities: [], countries: [], sources: [],
      minImportance: 0, liveOnly: false, timeRange: "all",
    });
  }

  const hasFilters = filter.query || filter.categories.length || filter.severities.length ||
    filter.countries.length || filter.sources.length || filter.minImportance > 0 ||
    filter.liveOnly || filter.timeRange !== "all";

  return (
    <div className="glass-card space-y-3 p-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Search title, country, entity, keyword, source…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {filter.query && (
            <button type="button" onClick={() => update({ query: "" })}
              className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setAdvancedOpen((o) => !o)}
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${advancedOpen ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {hasFilters && <span className="rounded-full bg-primary px-1 text-[9px] text-primary-foreground">•</span>}
          {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {hasFilters && (
          <button type="button" onClick={clearAll}
            className="rounded-md border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      {/* Severity quick pills (always visible) */}
      <div className="flex flex-wrap gap-1.5">
        {SEVERITIES.map((s) => {
          const m = SEVERITY_META[s];
          const active = filter.severities.includes(s);
          return (
            <button key={s} type="button" onClick={() => toggleSeverity(s)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                active ? `${m.bg} ${m.color} ${m.border}` : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Advanced filters panel */}
      {advancedOpen && (
        <div className="space-y-3 border-t border-border/30 pt-3">
          {/* Categories */}
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Category</div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((c) => {
                const active = filter.categories.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCategory(c)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                      active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}>
                    {categoryLabel(c)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time range */}
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Time Range</div>
            <div className="flex flex-wrap gap-1.5">
              {TIME_RANGES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => update({ timeRange: value })}
                  className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                    filter.timeRange === value ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Min importance */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Min Importance</span>
              <span className="text-foreground font-medium">{filter.minImportance}+</span>
            </div>
            <input
              type="range" min={0} max={80} step={10}
              value={filter.minImportance}
              onChange={(e) => update({ minImportance: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>All</span><span>40+</span><span>High (80+)</span>
            </div>
          </div>

          {/* Countries (dynamic from event pool) */}
          {availableCountries.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Country</div>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {availableCountries.slice(0, 30).map((c) => (
                  <button key={c} type="button" onClick={() => toggleCountry(c)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                      filter.countries.includes(c) ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live only toggle */}
          <label className="flex cursor-pointer items-center gap-2.5">
            <div className={`relative h-5 w-9 rounded-full border transition-colors ${filter.liveOnly ? "border-primary bg-primary" : "border-border/60 bg-secondary/30"}`}
              onClick={() => update({ liveOnly: !filter.liveOnly })}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${filter.liveOnly ? "left-4" : "left-0.5"}`} />
            </div>
            <span className="text-sm">Live events only</span>
          </label>
        </div>
      )}
    </div>
  );
}
