/**
 * BreakingIntelligencePanel — Priority-ranked intelligence feed.
 *
 * Left-column panel for the Operations Dashboard.
 * Shows highest-priority events (critical → high → medium) in a compact,
 * information-dense format for rapid scanning.
 *
 * Each item displays:
 *  • Priority colour stripe (left border)
 *  • Severity badge
 *  • Category + country
 *  • Time elapsed
 *  • Source
 *  • Title (2 lines)
 *  • View details + open source actions
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, ExternalLink, Eye, ArrowRight, Newspaper } from "lucide-react";
import { useT } from "@/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import type { IntelligenceItem } from "@/types";

const PRIORITY_STYLES: Record<string, { stripe: string; badge: string; bg: string }> = {
  critical: { stripe: "border-l-rose-500",          badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",    bg: "bg-rose-500/5 hover:bg-rose-500/8" },
  high:     { stripe: "border-l-amber-500",          badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", bg: "bg-amber-500/5 hover:bg-amber-500/8" },
  medium:   { stripe: "border-l-blue-500",           badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",   bg: "bg-blue-500/3 hover:bg-blue-500/6" },
  low:      { stripe: "border-l-emerald-500/60",     badge: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", bg: "hover:bg-secondary/30" },
};

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function elapsed(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
    return `${Math.round(ms / 86_400_000)}d`;
  } catch { return "—"; }
}

interface Props {
  items: IntelligenceItem[] | null;
  loading?: boolean;
  maxItems?: number;
  onSave?: (item: IntelligenceItem) => Promise<void>;
}

export function BreakingIntelligencePanel({ items, loading = false, maxItems = 10, onSave }: Props) {
  const t = useT();
  const [activeModal, setActiveModal] = useState<IntelligenceItem | null>(null);

  const sorted = useMemo(() => {
    if (!items) return [];
    return [...items]
      .sort((a, b) => {
        const ds = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
        if (ds !== 0) return ds;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, maxItems);
  }, [items, maxItems]);

  const critCount = useMemo(() => items?.filter((i) => i.severity === "critical").length ?? 0, [items]);

  return (
    <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="p-4 pb-3 border-b border-border/30">
        <SectionHeader
          title={t("app.pages.dashboard.breakingIntel.title")}
          subtitle={
            critCount > 0
              ? t(critCount > 1 ? "app.pages.dashboard.breakingIntel.subtitleCriticalPlural" : "app.pages.dashboard.breakingIntel.subtitleCritical", { count: critCount })
              : t("app.pages.dashboard.breakingIntel.subtitleDefault")
          }
          right={
            <div className="flex items-center gap-1.5">
              {critCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                  <Zap className="h-2.5 w-2.5" aria-hidden="true" /> {critCount} CRIT
                </span>
              )}
              <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          }
          size="sm"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {loading && !items ? (
          <div className="p-4">
            <LoadingSpinner variant="center" size="md" label={t("app.pages.dashboard.breakingIntel.loading")} />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState title={t("app.pages.dashboard.breakingIntel.emptyTitle")} hint={t("app.pages.dashboard.breakingIntel.emptyHint")} compact />
        ) : (
          <div className="panel-scroll flex-1 min-h-0" role="feed" aria-label={t("app.pages.dashboard.breakingIntel.title")}>
            {sorted.map((item) => {
              const styles = PRIORITY_STYLES[item.severity] ?? PRIORITY_STYLES.low;
              return (
                <article key={item.id} className={`flex gap-0 border-b border-border/25 transition-colors last:border-0 ${styles.bg}`}>
                  <div className={`w-0.5 flex-shrink-0 border-l-2 ${styles.stripe}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${styles.badge}`}>{item.severity}</span>
                      {item.category && <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-medium">{item.category}</span>}
                      {item.country && <><span className="text-muted-foreground/40 text-[9px]">·</span><span className="text-[9px] text-muted-foreground/80">{item.country}</span></>}
                      <span className="ml-auto text-[9px] text-muted-foreground/60 tabular-nums flex-shrink-0">{elapsed(item.publishedAt)}</span>
                    </div>
                    <button type="button" onClick={() => setActiveModal(item)} className="text-left w-full group" aria-label={`View details for: ${item.title}`}>
                      <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
                    </button>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground/60">{item.source}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setActiveModal(item)} className="rounded border border-border/40 p-1 text-muted-foreground/60 hover:text-primary hover:border-primary/40 transition-colors" aria-label={t("app.ui.viewDetails")}><Eye className="h-3 w-3" /></button>
                        {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="rounded border border-border/40 p-1 text-muted-foreground/60 hover:text-primary hover:border-primary/40 transition-colors" aria-label={t("app.ui.openSource")}><ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 pt-2 border-t border-border/30">
        <Link to="/intelligence" className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full">
          {t("app.pages.dashboard.breakingIntel.fullFeed")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <IntelligenceDetailsModal item={activeModal} onClose={() => setActiveModal(null)} onSave={onSave ?? (async () => {})} />
    </div>
  );
}
