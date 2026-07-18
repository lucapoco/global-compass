import type { IntelligenceItem } from "@/types";
import { X, ExternalLink, Bookmark } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { sanitizeUrl } from "@/lib/utils";

interface Props {
  item: IntelligenceItem | null;
  onClose: () => void;
  onSave?: (i: IntelligenceItem) => void;
}

export function IntelligenceDetailsModal({ item, onClose, onSave }: Props) {
  if (!item) return null;
  const safeUrl = sanitizeUrl(item.url);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="glass-card relative max-h-[85vh] w-full max-w-2xl overflow-auto p-5 pr-12">
        <button onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <DataBadge variant={item.isLive ? "live" : "demo"}>{item.isLive ? "Live" : "Demo"}</DataBadge>
          <DataBadge variant="source">{item.source}</DataBadge>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.category} · {item.severity}</span>
          {item.country && <span className="text-[11px] text-muted-foreground">· {item.country}</span>}
        </div>

        <h2 className="mt-3 text-lg font-semibold leading-snug break-words">{item.title}</h2>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {new Date(item.publishedAt).toLocaleString()}
        </div>

        {item.imageUrl && (
          <img src={item.imageUrl} alt="" className="mt-3 max-h-64 w-full rounded-lg border border-border/60 object-cover" />
        )}

        {item.description && (
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{item.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {safeUrl && (
            <a href={safeUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <ExternalLink className="h-3.5 w-3.5" /> Read full article
            </a>
          )}
          {onSave && (
            <button onClick={() => onSave(item)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs">
              <Bookmark className="h-3.5 w-3.5" /> Save to Supabase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
