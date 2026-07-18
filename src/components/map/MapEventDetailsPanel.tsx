import { useState } from "react";
import { Bookmark, ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { buildNewsContext, sendGlobalPulseAIChat } from "@/services/aiNewsAnalystService";
import { useT } from "@/i18n";

interface Props {
  event: GlobalEvent;
  relatedEvents: GlobalEvent[];
  onClose: () => void;
  onLocate: (e: GlobalEvent) => void;
  onSave: (e: GlobalEvent) => void;
  onSelectRelated: (e: GlobalEvent) => void;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Professional selection side panel — full GlobalEvent detail, related events, AI Explain. */
export function MapEventDetailsPanel({ event, relatedEvents, onClose, onLocate, onSave, onSelectRelated }: Props) {
  const t = useT();
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const hasCoords = !!event.coordinates;

  async function explainWithAI() {
    setAiLoading(true);
    setAiError(null);
    try {
      const ctx = await buildNewsContext({ force: false });
      const question = `Explain this event for a student in 2-3 short sentences, using ONLY the facts given (do not invent anything else): "${event.title}". Category: ${event.category}. Severity: ${event.severity}. Risk score: ${event.riskScore}/100. Confidence: ${event.confidence}/100. Country: ${event.country ?? "unknown"}. Provider: ${event.provider}.`;
      const result = await sendGlobalPulseAIChat([], question, ctx);
      setAiExplanation(result.answer);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("app.pages.map.ui.aiExplainFailed"));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="glass-card flex max-h-[70vh] flex-col overflow-hidden p-3 lg:max-h-none lg:h-full">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded border border-border/50 px-1">{event.category}</span>
          <span className="rounded border border-border/50 px-1">{event.severity}</span>
          <span className="rounded border border-border/50 px-1">{event.status}</span>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border/50 p-1 text-muted-foreground hover:text-foreground" aria-label={t("app.pages.map.ui.closePanel")}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto pr-1">
        <div>
          <h3 className="text-sm font-semibold leading-snug">{event.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{event.summary}</p>
        </div>

        <div className="rounded-md border border-border/40 bg-secondary/15 p-2">
          <StatRow label={t("app.pages.map.ui.country")} value={event.country ?? "—"} />
          <StatRow label={t("app.pages.map.ui.time")} value={new Date(event.timestamp).toLocaleString()} />
          <StatRow label={t("app.pages.map.ui.provider")} value={event.provider} />
          <StatRow label={t("app.pages.map.ui.category")} value={event.category} />
          <StatRow label={t("app.pages.map.ui.severity")} value={event.severity} />
          <StatRow label={t("app.pages.map.ui.riskScore")} value={`${event.riskScore} / 100`} />
          <StatRow label={t("app.ui.confidence")} value={`${event.confidence} / 100`} />
          <StatRow label={t("app.pages.map.ui.importance")} value={`${event.importance} / 100`} />
          <StatRow
            label={t("app.pages.map.ui.coordinates")}
            value={hasCoords ? `${event.coordinates!.lat.toFixed(3)}, ${event.coordinates!.lng.toFixed(3)}` : "—"}
          />
          <StatRow label={t("app.pages.map.ui.verified")} value={event.verified ? t("app.pages.map.ui.yes") : t("app.pages.map.ui.no")} />
          <StatRow label={t("app.pages.map.ui.live")} value={event.live ? t("app.pages.map.ui.yes") : t("app.pages.map.ui.no")} />
        </div>

        {relatedEvents.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("app.pages.map.ui.relatedEvents", { count: relatedEvents.length })}
            </div>
            <div className="space-y-1">
              {relatedEvents.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRelated(r)}
                  className="block w-full rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5 text-left text-[11px] hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="line-clamp-1 font-medium text-foreground">{r.title}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.category} · {r.severity} · {r.provider}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => void explainWithAI()}
            disabled={aiLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t("app.pages.map.ui.aiExplain")}
          </button>
          {aiExplanation && <p className="mt-2 rounded-md border border-border/40 bg-secondary/15 p-2 text-xs leading-relaxed">{aiExplanation}</p>}
          {aiError && <p className="mt-2 text-[11px] text-amber-600">{aiError}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 border-t border-border/30 pt-2">
        <button
          type="button"
          onClick={() => onLocate(event)}
          disabled={!hasCoords}
          className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("app.pages.map.ui.locateOnMap")}
        </button>
        {event.sourceUrl ? (
          <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <ExternalLink className="h-3 w-3" /> {t("app.ui.openSource")}
          </a>
        ) : (
          <span className="cursor-not-allowed rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground opacity-50">{t("app.ui.openSource")}</span>
        )}
        <button type="button" onClick={() => onSave(event)} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:text-primary">
          <Bookmark className="h-3 w-3" /> {t("app.ui.save")}
        </button>
      </div>
    </div>
  );
}
