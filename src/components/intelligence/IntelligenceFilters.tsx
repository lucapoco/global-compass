import type { IntelligenceCategory, IntelligenceSeverity } from "@/types";
import { Search } from "lucide-react";

export const CATEGORIES: (IntelligenceCategory | "all")[] = [
  "all", "geopolitics", "military", "economy", "technology", "energy",
  "climate", "disaster", "cyber", "health", "general",
];
export const SEVERITIES: (IntelligenceSeverity | "all")[] = ["all", "critical", "high", "medium", "low"];

interface Props {
  query: string;
  setQuery: (s: string) => void;
  category: IntelligenceCategory | "all";
  setCategory: (c: IntelligenceCategory | "all") => void;
  severity: IntelligenceSeverity | "all";
  setSeverity: (s: IntelligenceSeverity | "all") => void;
  onSearch?: () => void;
}

export function IntelligenceFilters(p: Props) {
  return (
    <div className="glass-card space-y-3 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && p.onSearch?.()}
            placeholder="Search world headlines (e.g. ukraine, oil, ai)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button onClick={p.onSearch}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
          Search
        </button>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Category</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => p.setCategory(c)}
              className={`rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                p.category === c ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Severity</div>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => p.setSeverity(s)}
              className={`rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                p.severity === s ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
