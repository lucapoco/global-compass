/**
 * EventDetailsDrawer — rich side panel for a selected IntelligenceEvent.
 *
 * Shows: all metadata · entities · keywords · related events · AI summary ·
 *        actions (Open, Save, Locate, AI Explain)
 */
import type { IntelligenceEvent } from "@/services/intelligence/types";
import { X, ExternalLink, Bookmark, MapPin, Brain, Link2, Clock, Globe } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { SEVERITY_META } from "@/services/intelligence/ranking/severityEngine";
import { categoryLabel } from "@/services/intelligence/nlp/categoryEngine";

interface Props {
  event: IntelligenceEvent | null;
  relatedEvents?: IntelligenceEvent[];
  aiLoading?: boolean;
  onClose: () => void;
  onSave?: (ev: IntelligenceEvent) => void;
  onLocate?: (ev: IntelligenceEvent) => void;
  onAI?: (ev: IntelligenceEvent) => void;
  onSelectRelated?: (ev: IntelligenceEvent) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function TagCloud({ items, color = "border-border/50 text-muted-foreground" }: { items: string[]; color?: string }) {
  if (!items.length) return <span className="text-[11px] text-muted-foreground/50">None detected</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className={`rounded border px-2 py-0.5 text-[10px] ${color}`}>{t}</span>
      ))}
    </div>
  );
}

export function EventDetailsDrawer({ event: ev, relatedEvents = [], aiLoading, onClose, onSave, onLocate, onAI, onSelectRelated }: Props) {
  if (!ev) return null;

  const sev = SEVERITY_META[ev.severity];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
          <span className="text-sm font-semibold">Event Details</span>
          <button type="button" onClick={onClose} className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sev.bg} ${sev.color} ${sev.border}`}>
              {sev.label}
            </span>
            {ev.categories.map((c) => (
              <span key={c} className="rounded-full border border-border/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
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

          {/* Title + summary */}
          <div>
            <h2 className="text-base font-semibold leading-snug">{ev.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ev.summary}</p>
          </div>

          {/* Hero image */}
          {ev.imageUrl && (
            <img src={ev.imageUrl} alt="" className="max-h-44 w-full rounded-lg border border-border/60 object-cover" />
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Importance", value: ev.importance, suffix: "/100" },
              { label: "Confidence", value: ev.confidence, suffix: "%" },
              { label: "Sources", value: ev.articleCount, suffix: "" },
            ].map(({ label, value, suffix }) => (
              <div key={label} className="rounded-lg border border-border/40 bg-secondary/20 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{value}<span className="text-xs font-normal text-muted-foreground">{suffix}</span></div>
              </div>
            ))}
          </div>

          {/* Geo + time */}
          <Section title="Location & Time">
            <div className="space-y-1 text-sm">
              {ev.country && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{ev.country}{ev.region ? ` · ${ev.region}` : ""}</span>
                </div>
              )}
              {ev.coordinates && (
                <div className="text-[11px] text-muted-foreground/60">
                  {ev.coordinates.lat.toFixed(2)}°, {ev.coordinates.lng.toFixed(2)}°
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(ev.publishedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span>{ev.source}</span>
              </div>
            </div>
          </Section>

          {/* Keywords */}
          <Section title="Keywords">
            <TagCloud items={ev.keywords} color="border-border/50 text-muted-foreground" />
          </Section>

          {/* Entities */}
          {(ev.entities.leaders.length > 0 || ev.entities.organizations.length > 0 || ev.entities.countries.length > 0) && (
            <Section title="Detected Entities">
              <div className="space-y-2">
                {ev.entities.leaders.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground/60">Leaders · </span>
                    <TagCloud items={ev.entities.leaders} color="border-amber-glow/30 text-amber-glow" />
                  </div>
                )}
                {ev.entities.organizations.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground/60">Organizations · </span>
                    <TagCloud items={ev.entities.organizations} color="border-cyan-glow/30 text-cyan-glow" />
                  </div>
                )}
                {ev.entities.countries.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground/60">Countries · </span>
                    <TagCloud items={ev.entities.countries} color="border-primary/30 text-primary" />
                  </div>
                )}
                {ev.entities.companies.length > 0 && (
                  <div>
                    <span className="text-[10px] text-muted-foreground/60">Companies · </span>
                    <TagCloud items={ev.entities.companies} color="border-emerald-glow/30 text-emerald-glow" />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* AI Summary */}
          {(ev.aiSummary || aiLoading) && (
            <Section title="AI Analysis">
              {aiLoading ? (
                <div className="space-y-1.5">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-3 animate-pulse rounded bg-secondary/40" />)}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">{ev.aiSummary}</p>
              )}
            </Section>
          )}

          {/* Related events */}
          {relatedEvents.length > 0 && (
            <Section title={`Related Events (${relatedEvents.length})`}>
              <div className="space-y-1.5">
                {relatedEvents.map((r) => (
                  <button key={r.id} type="button" onClick={() => onSelectRelated?.(r)}
                    className="flex w-full items-start gap-2 rounded-md border border-border/40 bg-secondary/20 p-2 text-left hover:border-primary/30">
                    <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground">{r.country} · {r.source}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Cluster sources */}
          {ev.clusterSources.length > 0 && (
            <Section title={`Clustered Articles (${ev.clusterSources.length})`}>
              <div className="space-y-1">
                {ev.clusterSources.map((s) => (
                  <div key={s.url || s.title} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted-foreground">{s.source} · {s.title}</span>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Action footer */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border/40 bg-background/95 p-3 backdrop-blur">
          {ev.url && (
            <a href={ev.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <ExternalLink className="h-3.5 w-3.5" /> Open Source
            </a>
          )}
          {onLocate && ev.coordinates && (
            <button type="button" onClick={() => onLocate(ev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <MapPin className="h-3.5 w-3.5" /> Locate on Map
            </button>
          )}
          {onAI && (
            <button type="button" onClick={() => onAI(ev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary">
              <Brain className="h-3.5 w-3.5" /> AI Explain
            </button>
          )}
          {onSave && (
            <button type="button" onClick={() => onSave(ev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Bookmark className="h-3.5 w-3.5" /> Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
