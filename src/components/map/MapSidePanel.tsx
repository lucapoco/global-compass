import { Bookmark, Crosshair, ExternalLink, Eye } from "lucide-react";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  events: GlobalEvent[];
  selectedId: string | null;
  onLocate: (e: GlobalEvent) => void;
  onSave?: (e: GlobalEvent) => void;
  onDetails?: (e: GlobalEvent) => void;
}

function sevLabel(s: GlobalEvent["severity"]): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MapSidePanel({ events, selectedId, onLocate, onSave, onDetails }: Props) {
  const hasCoords = (e: GlobalEvent) => !!e.coordinates;

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="glass-card flex max-h-[70vh] flex-col overflow-hidden p-3 lg:max-h-none lg:h-full">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Visible events</h3>
          <span className="text-[10px] text-muted-foreground">
            {events.length} item{events.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-auto pr-1">
          {events.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
              No events match your filters.
            </div>
          ) : (
            events.map((e) => {
              const selected = e.id === selectedId;
              return (
                <div
                  key={e.id}
                  className={`rounded-md border p-2 transition-colors ${
                    selected ? "border-primary/50 bg-primary/10" : "border-border/40 bg-secondary/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        e.severity === "critical"
                          ? "bg-rose-glow"
                          : e.severity === "high"
                            ? "bg-amber-glow"
                            : e.severity === "medium"
                              ? "bg-cyan-glow"
                              : "bg-emerald-glow"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium">{e.title}</div>
                      {e.description && (
                        <div className="line-clamp-2 text-[10px] text-muted-foreground">{e.description}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span className="rounded border border-border/50 px-1 py-0">{e.category}</span>
                        <span>{sevLabel(e.severity)}</span>
                        <span>· risk {e.riskScore}</span>
                        <span>· {e.provider}</span>
                        {e.country && <span>· {e.country}</span>}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {e.source} · {new Date(e.timestamp).toLocaleString()}
                        {!hasCoords(e) ? <span className="ml-1 text-amber-600">· no coords</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onLocate(e)}
                          title="Locate on map"
                          className="rounded border border-border/50 p-1 hover:text-primary"
                        >
                          <Crosshair className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Locate on map</TooltipContent>
                    </Tooltip>
                    {onDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onDetails(e)}
                            className="rounded border border-border/50 p-1 hover:text-primary"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Details</TooltipContent>
                      </Tooltip>
                    )}
                    {e.sourceUrl ? (
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open source"
                        className="rounded border border-border/50 p-1 hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-not-allowed rounded border border-border/30 p-1 opacity-40">
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>No source URL available</TooltipContent>
                      </Tooltip>
                    )}
                    {onSave && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onSave(e)}
                            className="rounded border border-primary/40 bg-primary/10 p-1 text-primary"
                          >
                            <Bookmark className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Save to Supabase</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
