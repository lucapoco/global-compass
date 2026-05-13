import { useState } from "react";
import { ExternalLink, Bookmark, RefreshCw, Eye, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { IntelligenceItem } from "@/types";
import type { NewsStatus } from "@/services/newsApi";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";

interface Props {
  items: IntelligenceItem[] | null;
  status: NewsStatus;
  loading?: boolean;
  onRefresh: () => void;
  cooldownLeft?: number;
}

function variant(s: NewsStatus): "live" | "neutral" | "demo" | "error" {
  if (s === "live") return "live";
  if (s === "cached") return "neutral";
  if (s === "rate_limited" || s === "error") return "error";
  return "demo";
}
function label(s: NewsStatus): string {
  return s === "live" ? "Live" : s === "cached" ? "Cached" : s === "rate_limited" ? "Rate limited" : s === "error" ? "Error" : "Demo";
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-rose-glow/20 text-rose-glow border-rose-glow/40",
  high: "bg-amber-glow/15 text-amber-glow border-amber-glow/30",
  medium: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  low: "bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30",
};

export function LiveIntelligencePanel({ items, status, loading, onRefresh, cooldownLeft = 0 }: Props) {
  const [active, setActive] = useState<IntelligenceItem | null>(null);

  async function save(i: IntelligenceItem) {
    if (!isSupabaseConfigured()) { toast.error("Backend not configured."); return; }
    try {
      await supabaseService.saveIntelligence(i);
      toast.success("Saved.");
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  const six = (items ?? []).slice(0, 6);
  const disabled = loading || cooldownLeft > 0;

  return (
    <div className="glass-card flex flex-col p-4">
      <SectionHeader
        title="Live Intelligence Feed"
        subtitle="Latest 6 normalized headlines"
        right={
          <div className="flex items-center gap-2">
            <DataBadge variant={variant(status)}>{label(status)}</DataBadge>
            <button
              onClick={onRefresh}
              disabled={disabled}
              title={cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Refresh"}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Link to="/intelligence" className="text-[11px] text-primary hover:underline">Open feed →</Link>
          </div>
        }
      />

      {!items ? (
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md border border-border/40 bg-secondary/30" />
          ))}
        </div>
      ) : six.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/50 p-6 text-xs text-muted-foreground">
          <Radio className="mr-2 h-4 w-4" /> No headlines available right now.
        </div>
      ) : (
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          {six.map((i) => (
            <div key={i.id} className="group flex flex-col gap-1.5 rounded-md border border-border/40 bg-secondary/20 p-2.5 transition-colors hover:border-primary/40">
              <div className="flex flex-wrap items-center gap-1">
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEV_COLORS[i.severity]}`}>
                  {i.severity}
                </span>
                <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                  {i.category}
                </span>
                {i.country && <span className="text-[9px] text-muted-foreground">· {i.country}</span>}
                <span className="ml-auto text-[9px] text-muted-foreground">
                  {new Date(i.publishedAt).toLocaleTimeString()}
                </span>
              </div>
              <button onClick={() => setActive(i)} className="text-left">
                <div className="line-clamp-2 text-[12px] font-medium leading-snug group-hover:text-primary">{i.title}</div>
              </button>
              <div className="mt-auto flex items-center justify-between gap-1.5 text-[10px]">
                <span className="truncate text-muted-foreground">{i.source}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setActive(i)} title="Details" className="rounded border border-border/50 p-1 hover:text-primary">
                    <Eye className="h-3 w-3" />
                  </button>
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noreferrer" title="Open source" className="rounded border border-border/50 p-1 hover:text-primary">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <button onClick={() => save(i)} title="Save" className="rounded border border-primary/40 bg-primary/10 p-1 text-primary">
                    <Bookmark className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <IntelligenceDetailsModal item={active} onClose={() => setActive(null)} onSave={save} />
    </div>
  );
}
