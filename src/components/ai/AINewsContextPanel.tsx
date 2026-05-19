import { RefreshCw, ShieldAlert, Newspaper, Activity, Bookmark, Database } from "lucide-react";
import type { AINewsContext } from "@/services/aiNewsAnalystService";
import type { GeminiProviderStatus } from "@/lib/aiChatTypes";
import type { GlobalEvent } from "@/types";
import { DataBadge } from "@/components/ui/DataBadge";
import { Button } from "@/components/ui/button";

function statusVariant(ctx: AINewsContext): "live" | "neutral" | "demo" | "error" {
  if (ctx.newsStatus === "live") return "live";
  if (ctx.newsStatus === "cached") return "neutral";
  if (ctx.newsStatus === "demo") return "demo";
  return "error";
}

function HeadlineRow({ e }: { e: GlobalEvent }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/15 px-2.5 py-2 text-[11px]">
      <div className="line-clamp-2 font-medium leading-snug">{e.title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
        <span className="uppercase text-rose-glow/90">{e.severity}</span>
        <span>· {e.category}</span>
        <span>· {e.source}</span>
      </div>
    </div>
  );
}

function geminiStatusVariant(
  status: GeminiProviderStatus,
): "live" | "neutral" | "demo" | "error" {
  if (status === "GEMINI LIVE" || status === "GEMINI FALLBACK MODEL") return "live";
  if (status === "LOCAL FALLBACK" || status === "GEMINI TEMPORARILY BUSY") return "neutral";
  if (status === "GEMINI ERROR") return "error";
  return "demo";
}

interface Props {
  context: AINewsContext | null;
  loading?: boolean;
  onRefresh: () => void;
  geminiStatus?: GeminiProviderStatus;
  geminiModel?: string;
}

export function AINewsContextPanel({
  context,
  loading,
  onRefresh,
  geminiStatus = "GEMINI NOT CONFIGURED",
  geminiModel = "gemini-2.5-flash-lite",
}: Props) {
  if (!context) {
    return (
      <div className="glass-card flex h-full min-h-[280px] flex-col gap-3 p-4">
        <div className="h-6 w-32 animate-pulse rounded bg-secondary/50" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-secondary/40" />
          ))}
        </div>
      </div>
    );
  }

  const topHeadlines = [...context.intelligenceItems]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 3);

  const topRisks = (context.countryRisks ?? []).slice(0, 3);

  return (
    <div className="glass-card flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Live context</h2>
          <p className="text-[11px] text-muted-foreground">Signals feeding this analyst</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <DataBadge variant={statusVariant(context)}>{context.dataStatus.news} DATA</DataBadge>

      <div className="rounded-md border border-border/40 bg-secondary/10 px-2.5 py-2 text-[11px]">
        <div className="font-medium text-foreground">Google Gemini</div>
        <div className="mt-0.5 text-muted-foreground">{geminiModel}</div>
        <div className="mt-2">
          <DataBadge variant={geminiStatusVariant(geminiStatus)}>{geminiStatus}</DataBadge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <Newspaper className="mx-auto h-4 w-4 text-primary" />
          <div className="mt-1 text-lg font-semibold tabular-nums">{context.intelligenceItems.length}</div>
          <div className="text-[10px] text-muted-foreground">Headlines</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <ShieldAlert className="mx-auto h-4 w-4 text-rose-glow" />
          <div className="mt-1 text-lg font-semibold tabular-nums">{context.criticalAlerts.length}</div>
          <div className="text-[10px] text-muted-foreground">Critical / high</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <Activity className="mx-auto h-4 w-4 text-amber-glow" />
          <div className="mt-1 text-lg font-semibold tabular-nums">{context.earthquakes.length}</div>
          <div className="text-[10px] text-muted-foreground">Earthquakes</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <Bookmark className="mx-auto h-4 w-4 text-cyan-glow" />
          <div className="mt-1 text-lg font-semibold tabular-nums">{context.savedIntelligence?.length ?? 0}</div>
          <div className="text-[10px] text-muted-foreground">Saved intel</div>
        </div>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Sources
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5">
          News: {context.dataStatus.news} · {context.newsSource}
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5">
          USGS: {context.dataStatus.earthquakes}
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5">
          Supabase: {context.dataStatus.supabase}
        </div>
        {context.lastUpdated ? (
          <p className="text-[10px] text-muted-foreground">Updated {new Date(context.lastUpdated).toLocaleString()}</p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top headlines</h3>
        <div className="space-y-2">
          {topHeadlines.length ? topHeadlines.map((e) => <HeadlineRow key={e.id} e={e} />) : (
            <p className="text-[11px] text-muted-foreground">No headlines loaded.</p>
          )}
        </div>
      </div>

      {topRisks.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Country risk</h3>
          <div className="space-y-1.5">
            {topRisks.map((r) => (
              <div key={r.country} className="flex justify-between rounded-md border border-border/40 px-2 py-1.5 text-[11px]">
                <span>{r.country}</span>
                <span className="tabular-nums text-amber-glow">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
