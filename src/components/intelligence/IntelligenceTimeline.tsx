/**
 * IntelligenceTimeline — professional news timeline.
 *
 * Groups events into: Today · Yesterday · Older
 * Renders a vertical timeline with animated markers and time labels.
 */
import type { IntelligenceEvent } from "@/services/intelligence/types";
import { IntelligenceEventCard } from "./IntelligenceEventCard";

interface Props {
  events: IntelligenceEvent[];
  onOpen?: (ev: IntelligenceEvent) => void;
  onSave?: (ev: IntelligenceEvent) => void;
  onLocate?: (ev: IntelligenceEvent) => void;
  onAI?: (ev: IntelligenceEvent) => void;
  onRelated?: (ev: IntelligenceEvent) => void;
  layout?: "compact" | "detailed";
}

function groupEvents(events: IntelligenceEvent[]): Record<"Today" | "Yesterday" | "Older", IntelligenceEvent[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  const groups: Record<"Today" | "Yesterday" | "Older", IntelligenceEvent[]> = {
    Today: [],
    Yesterday: [],
    Older: [],
  };

  for (const ev of events) {
    const t = new Date(ev.publishedAt).getTime();
    if (t >= todayStart) groups.Today.push(ev);
    else if (t >= yesterdayStart) groups.Yesterday.push(ev);
    else groups.Older.push(ev);
  }

  return groups;
}

const GROUP_ACCENT: Record<string, string> = {
  Today: "text-primary",
  Yesterday: "text-cyan-glow",
  Older: "text-muted-foreground",
};

const GROUP_DOT: Record<string, string> = {
  Today: "bg-primary",
  Yesterday: "bg-cyan-glow",
  Older: "bg-muted-foreground",
};

export function IntelligenceTimeline({ events, onOpen, onSave, onLocate, onAI, onRelated, layout = "compact" }: Props) {
  const groups = groupEvents(events);
  const sections = Object.entries(groups).filter(([, evs]) => evs.length > 0) as Array<[string, IntelligenceEvent[]]>;

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map(([group, evs]) => (
        <div key={group}>
          {/* Group header */}
          <div className="mb-3 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${GROUP_DOT[group] ?? "bg-muted-foreground"}`} />
            <span className={`text-xs font-semibold uppercase tracking-widest ${GROUP_ACCENT[group] ?? "text-muted-foreground"}`}>
              {group}
            </span>
            <span className="text-[11px] text-muted-foreground">· {evs.length} events</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* Cards */}
          <div className={`grid gap-3 ${layout === "detailed" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
            {evs.map((ev) => (
              <IntelligenceEventCard
                key={ev.id}
                event={ev}
                layout={layout}
                onOpen={onOpen}
                onSave={onSave}
                onLocate={onLocate}
                onAI={onAI}
                onRelated={onRelated}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
