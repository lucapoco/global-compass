import { Search } from "lucide-react";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

interface Props {
  value: string;
  onChange: (v: string) => void;
  results?: GlobalEvent[];
  onSelectResult?: (event: GlobalEvent) => void;
}

/** Unified search box — country / city / keyword / provider / category / tag, per the shared `searchEvents` engine. */
export function MapSearchBox({ value, onChange, results, onSelectResult }: Props) {
  const showResults = Boolean(value.trim() && results && onSelectResult);
  return (
    <div className="relative">
      <div className="glass-card flex items-center gap-2 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search country, city, keyword, provider, category or tag…"
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <button onClick={() => onChange("")} className="text-[10px] text-muted-foreground hover:text-foreground">
            clear
          </button>
        )}
      </div>
      {showResults && (
        <div className="glass-card absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto p-1">
          {results!.length === 0 ? (
            <div className="p-2 text-[11px] text-muted-foreground">No matches.</div>
          ) : (
            results!.slice(0, 8).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectResult!(r)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-secondary/40"
              >
                <span className="line-clamp-1 text-xs font-medium">{r.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.category} · {r.severity} · {r.provider}
                  {r.country ? ` · ${r.country}` : ""}
                  {r.coordinates ? "" : " · no coords"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
