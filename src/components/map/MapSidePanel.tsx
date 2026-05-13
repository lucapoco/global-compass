import { Bookmark, Crosshair, ExternalLink, Eye } from "lucide-react";
import type { MapEvent } from "@/types";

interface Props {
  events: MapEvent[];
  onLocate: (e: MapEvent) => void;
  onSave?: (e: MapEvent) => void;
  onDetails?: (e: MapEvent) => void;
}

const SEV_COLOR: Record<string, string> = {
  Critical: "bg-rose-glow",
  High: "bg-amber-glow",
  Medium: "bg-cyan-glow",
  Low: "bg-emerald-glow",
};

export function MapSidePanel({ events, onLocate, onSave, onDetails }: Props) {
  return (
    <aside className="glass-card flex h-full flex-col overflow-hidden p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Visible events</h3>
        <span className="text-[10px] text-muted-foreground">{events.length} item{events.length === 1 ? "" : "s"}</span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto pr-1">
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
            No events match your filters.
          </div>
        ) : events.map((e) => {
          // Look up the source URL if present (some events have a url via id mapping; we keep it simple here)
          const url = e.url;
          return (
            <div key={e.id} className="rounded-md border border-border/40 bg-secondary/20 p-2">
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV_COLOR[e.severity ?? ""] ?? "bg-emerald-glow"}`} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs font-medium">{e.title}</div>
                  {e.description && <div className="truncate text-[10px] text-muted-foreground">{e.description}</div>}
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {e.type}{e.severity ? ` · ${e.severity}` : ""}{e.category ? ` · ${e.category}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1">
                <button onClick={() => onLocate(e)} title="Locate on map" className="rounded border border-border/50 p-1 hover:text-primary"><Crosshair className="h-3 w-3" /></button>
                {onDetails && <button onClick={() => onDetails(e)} title="Details" className="rounded border border-border/50 p-1 hover:text-primary"><Eye className="h-3 w-3" /></button>}
                {url && <a href={url} target="_blank" rel="noreferrer" title="Open source" className="rounded border border-border/50 p-1 hover:text-primary"><ExternalLink className="h-3 w-3" /></a>}
                {onSave && <button onClick={() => onSave(e)} title="Save alert" className="rounded border border-primary/40 bg-primary/10 p-1 text-primary"><Bookmark className="h-3 w-3" /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
