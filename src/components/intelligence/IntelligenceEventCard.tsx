/**
 * IntelligenceEventCard — upgraded card for IntelligenceEvent objects.
 *
 * Displays: severity badge · categories · importance score · country · time ·
 *           confidence · entities · source · quick actions (Open, Locate, Save, AI, Related)
 */
import type { IntelligenceEvent } from "@/services/intelligence/types";
import { DataBadge } from "@/components/ui/DataBadge";
import { Bookmark, ExternalLink, MapPin, Brain, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SEVERITY_META } from "@/services/intelligence/ranking/severityEngine";
import { categoryLabel } from "@/services/intelligence/nlp/categoryEngine";

const CAT_COLORS: Record<string, string> = {
  military:       "border-rose-glow/40 text-rose-glow",
  cybersecurity:  "border-fuchsia-400/40 text-fuchsia-300",
  geopolitics:    "border-amber-glow/40 text-amber-glow",
  earthquake:     "border-orange-400/40 text-orange-300",
  disaster:       "border-orange-400/40 text-orange-300",
  economy:        "border-emerald-glow/40 text-emerald-glow",
  finance:        "border-emerald-glow/40 text-emerald-glow",
  energy:         "border-yellow-400/40 text-yellow-300",
  climate:        "border-sky-400/40 text-sky-300",
  weather:        "border-sky-400/40 text-sky-300",
  health:         "border-pink-400/40 text-pink-300",
  technology:     "border-cyan-glow/40 text-cyan-glow",
  diplomacy:      "border-violet-400/40 text-violet-300",
  space:          "border-indigo-400/40 text-indigo-300",
  infrastructure: "border-zinc-400/40 text-zinc-300",
  transportation: "border-zinc-400/40 text-zinc-300",
  migration:      "border-teal-400/40 text-teal-300",
  crime:          "border-red-400/40 text-red-300",
  science:        "border-cyan-glow/40 text-cyan-glow",
  environment:    "border-green-400/40 text-green-300",
  general:        "border-border/60 text-muted-foreground",
  unknown:        "border-border/60 text-muted-foreground",
};

interface Props {
  event: IntelligenceEvent;
  onOpen?: (ev: IntelligenceEvent) => void;
  onSave?: (ev: IntelligenceEvent) => void;
  onLocate?: (ev: IntelligenceEvent) => void;
  onAI?: (ev: IntelligenceEvent) => void;
  onRelated?: (ev: IntelligenceEvent) => void;
  layout?: "compact" | "detailed";
}

/** Format relative time ("2h ago", "just now", etc.). */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Importance bar color. */
function importanceColor(score: number): string {
  if (score >= 75) return "bg-rose-glow";
  if (score >= 50) return "bg-amber-glow";
  if (score >= 30) return "bg-cyan-glow";
  return "bg-emerald-glow";
}

export function IntelligenceEventCard({ event: ev, onOpen, onSave, onLocate, onAI, onRelated, layout = "compact" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isDetailed = layout === "detailed";
  const sev = SEVERITY_META[ev.severity];
  const catStyle = CAT_COLORS[ev.category] ?? CAT_COLORS.general;

  // Non-empty entity tags to show
  const entityTags: string[] = [
    ...ev.entities.leaders.slice(0, 2),
    ...ev.entities.organizations.slice(0, 2),
    ...ev.entities.alliances.slice(0, 1),
  ].filter(Boolean).slice(0, 4);

  return (
    <div className="glass-card group flex flex-col gap-2.5 p-3.5 transition-all hover:border-primary/40 hover:shadow-md">
      {/* Row 1: Badges + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sev.bg} ${sev.color} ${sev.border}`}>
            {sev.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${catStyle}`}>
            {categoryLabel(ev.category)}
          </span>
          {ev.categories.length > 1 && ev.categories.slice(1, 3).map((c) => (
            <span key={c} className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider opacity-70 ${CAT_COLORS[c] ?? CAT_COLORS.general}`}>
              {categoryLabel(c)}
            </span>
          ))}
          <DataBadge variant={ev.isLive ? "live" : "demo"}>{ev.isLive ? "LIVE" : "DEMO"}</DataBadge>
          {ev.articleCount > 1 && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {ev.articleCount} sources
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground" title={new Date(ev.publishedAt).toLocaleString()}>
          {relativeTime(ev.publishedAt)}
        </span>
      </div>

      {/* Row 2: Title */}
      <button type="button" onClick={() => onOpen?.(ev)} className="text-left">
        <h3 className={`font-semibold leading-snug text-foreground group-hover:text-primary ${isDetailed ? "text-base" : "text-sm"}`}>
          {ev.title}
        </h3>
        <p className={`mt-0.5 text-muted-foreground ${isDetailed ? "line-clamp-5 text-sm mt-1" : "line-clamp-2 text-xs"}`}>
          {ev.summary}
        </p>
      </button>

      {/* Row 3: Importance bar + scores */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Importance</span>
            <span className="text-[10px] font-semibold tabular-nums">{ev.importance}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/40">
            <div className={`h-full transition-all ${importanceColor(ev.importance)}`} style={{ width: `${ev.importance}%` }} />
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Conf</div>
          <div className="text-[11px] font-medium tabular-nums">{ev.confidence}%</div>
        </div>
      </div>

      {/* Row 4: Meta (country, source) + entities */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ev.country && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {ev.country}{ev.region ? ` · ${ev.region}` : ""}
          </span>
        )}
        <span>Source · <span className="text-foreground">{ev.source}</span></span>
      </div>

      {/* Entities row */}
      {entityTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entityTags.map((tag) => (
            <span key={tag} className="rounded border border-border/50 bg-secondary/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {tag}
            </span>
          ))}
          {ev.keywords.slice(0, 3).map((kw) => (
            <span key={kw} className="rounded border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
              #{kw}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: cluster sources */}
      {expanded && ev.clusterSources.length > 0 && (
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Additional Sources</div>
          {ev.clusterSources.map((s) => (
            <div key={s.url || s.title} className="flex items-center justify-between gap-2 py-0.5 text-[10px]">
              <span className="truncate text-muted-foreground">{s.title}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-muted-foreground/60">{s.source}</span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2">
        <div className="flex flex-wrap gap-1">
          {ev.url && (
            <a href={ev.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          )}
          {ev.coordinates && onLocate && (
            <button type="button" onClick={() => onLocate(ev)}
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <MapPin className="h-3 w-3" /> Locate
            </button>
          )}
          {onAI && (
            <button type="button" onClick={() => onAI(ev)}
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-primary">
              <Brain className="h-3 w-3" /> AI
            </button>
          )}
          {ev.relatedEventIds.length > 0 && onRelated && (
            <button type="button" onClick={() => onRelated(ev)}
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <Link2 className="h-3 w-3" /> {ev.relatedEventIds.length} Related
            </button>
          )}
          {ev.clusterSources.length > 0 && (
            <button type="button" onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {ev.clusterSources.length + 1} articles
            </button>
          )}
        </div>
        {onSave && (
          <button type="button" onClick={() => onSave(ev)}
            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary">
            <Bookmark className="h-3 w-3" /> Save
          </button>
        )}
      </div>
    </div>
  );
}
