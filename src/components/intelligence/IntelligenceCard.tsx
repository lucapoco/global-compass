import type { IntelligenceItem, IntelligenceSeverity } from "@/types";
import { DataBadge } from "@/components/ui/DataBadge";
import { Bookmark, ExternalLink } from "lucide-react";

const SEV_STYLES: Record<IntelligenceSeverity, string> = {
  critical: "bg-rose-glow/20 text-rose-glow border-rose-glow/40",
  high: "bg-amber-glow/15 text-amber-glow border-amber-glow/30",
  medium: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  low: "bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30",
};

const CAT_STYLES: Record<string, string> = {
  military: "border-rose-glow/40 text-rose-glow",
  geopolitics: "border-amber-glow/40 text-amber-glow",
  economy: "border-emerald-glow/40 text-emerald-glow",
  cyber: "border-fuchsia-400/40 text-fuchsia-300",
  disaster: "border-orange-400/40 text-orange-300",
  climate: "border-sky-400/40 text-sky-300",
  technology: "border-cyan-glow/40 text-cyan-glow",
  energy: "border-yellow-400/40 text-yellow-300",
  health: "border-pink-400/40 text-pink-300",
  general: "border-border/60 text-muted-foreground",
};

interface Props {
  item: IntelligenceItem;
  onOpen?: (i: IntelligenceItem) => void;
  onSave?: (i: IntelligenceItem) => void;
}

export function IntelligenceCard({ item, onOpen, onSave }: Props) {
  return (
    <div className="glass-card group flex flex-col gap-2 p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEV_STYLES[item.severity]}`}>
            {item.severity}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${CAT_STYLES[item.category] ?? CAT_STYLES.general}`}>
            {item.category}
          </span>
          {item.country && (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              {item.country}
            </span>
          )}
          <DataBadge variant={item.isLive ? "live" : "demo"}>{item.isLive ? "Live" : "Demo"}</DataBadge>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {new Date(item.publishedAt).toLocaleString()}
        </span>
      </div>

      <button onClick={() => onOpen?.(item)} className="text-left">
        <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}
      </button>

      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Source · <span className="text-foreground">{item.source}</span></span>
        <div className="flex items-center gap-1.5">
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          )}
          {onSave && (
            <button onClick={() => onSave(item)}
              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary">
              <Bookmark className="h-3 w-3" /> Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
