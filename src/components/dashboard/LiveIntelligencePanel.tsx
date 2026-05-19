import { useMemo, useState } from "react";
import { ExternalLink, Bookmark, RefreshCw, Eye, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { IntelligenceItem } from "@/types";
import type { NewsStatus } from "@/services/newsApi";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { Button } from "@/components/ui/button";

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
  if (s === "live") return "Live";
  if (s === "cached") return "Cached live data";
  if (s === "rate_limited") return "Rate limited";
  if (s === "error") return "API error";
  return "Demo";
}

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Show highest-severity newest items first (dashboard preview). */
function prioritizeForPreview(items: IntelligenceItem[], n: number): IntelligenceItem[] {
  return [...items]
    .sort((a, b) => {
      const da = SEV_RANK[a.severity] ?? 9;
      const db = SEV_RANK[b.severity] ?? 9;
      if (da !== db) return da - db;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, n);
}

const PREVIEW_COUNT = 12;

export function LiveIntelligencePanel({ items, status, loading, onRefresh, cooldownLeft = 0 }: Props) {
  const [active, setActive] = useState<IntelligenceItem | null>(null);

  const preview = useMemo(
    () => prioritizeForPreview(items ?? [], PREVIEW_COUNT),
    [items],
  );

  async function save(i: IntelligenceItem) {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    try {
      await supabaseService.saveIntelligence(i);
      toast.success("Event saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const disabled = loading || cooldownLeft > 0;

  return (
    <div className="glass-card flex min-h-[320px] flex-col p-4 lg:min-h-[380px]">
      <SectionHeader
        title="Live Intelligence Feed"
        subtitle={`Up to ${PREVIEW_COUNT} priority headlines · ${items?.length ?? 0} loaded`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DataBadge variant={variant(status)}>{label(status)}</DataBadge>
            <button
              type="button"
              onClick={onRefresh}
              disabled={disabled}
              title={cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Refresh"}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button asChild variant="default" size="sm" className="h-8 text-xs">
          <Link to="/intelligence">View Full Intelligence Feed</Link>
        </Button>
        <Link to="/intelligence" className="text-[11px] text-muted-foreground hover:text-primary hover:underline">
          Open monitoring workspace →
        </Link>
      </div>

      {!items ? (
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border/40 bg-secondary/30" />
          ))}
        </div>
      ) : preview.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 p-8 text-sm text-muted-foreground">
          <Radio className="mr-2 h-5 w-5 shrink-0" /> No headlines available right now.
        </div>
      ) : (
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((i) => (
            <div
              key={i.id}
              className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-secondary/15 p-3 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-full border border-rose-glow/30 bg-rose-glow/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-glow">
                  {i.severity}
                </span>
                <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                  {i.category}
                </span>
                {i.country ? <span className="text-[9px] text-muted-foreground">· {i.country}</span> : null}
                <span className="ml-auto text-[9px] text-muted-foreground">
                  {new Date(i.publishedAt).toLocaleTimeString()}
                </span>
              </div>
              <button type="button" onClick={() => setActive(i)} className="text-left">
                <div className="line-clamp-3 text-[12px] font-medium leading-snug hover:text-primary">{i.title}</div>
              </button>
              {i.description ? (
                <p className="line-clamp-2 text-[10px] text-muted-foreground">{i.description}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-1 border-t border-border/30 pt-2 text-[10px]">
                <span className="truncate text-muted-foreground">{i.source}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    title="Details"
                    className="rounded border border-border/50 p-1 hover:text-primary"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  {i.url ? (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open source"
                      className="rounded border border-border/50 p-1 hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => save(i)}
                    title="Save"
                    className="rounded border border-primary/40 bg-primary/10 p-1 text-primary"
                  >
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
