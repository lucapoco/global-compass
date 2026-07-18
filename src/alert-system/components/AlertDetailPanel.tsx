/**
 * AlertDetailPanel — Full detail view for a single GlobalAlert.
 */
import { useNavigate } from "@tanstack/react-router";
import { X, MapPin, Globe, Shield, Zap, Link2, Network, Clock } from "lucide-react";
import type { GlobalAlert } from "../types";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS } from "../types";
import { useT } from "@/i18n";

interface Props {
  alert: GlobalAlert;
  events: GlobalEvent[];
  onClose: () => void;
}

export function AlertDetailPanel({ alert, events, onClose }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const color = ALERT_LEVEL_COLORS[alert.level];

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 border-b border-border"
        style={{ background: `linear-gradient(135deg, ${color}18, transparent)` }}
      >
        <div className="flex-1 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ color, background: `${color}20` }}
          >
            {ALERT_LEVEL_LABELS[alert.level]}
          </span>
          <h2 className="text-base font-bold text-foreground mt-2 leading-tight">{alert.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{alert.summary}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" aria-label={t("app.ui.close")}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: "thin" }}>
        {/* Scores row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("app.pages.alertCenter.riskScore"), value: alert.riskScore, icon: Shield, color: "#ef4444" },
            { label: t("app.ui.confidence"), value: `${alert.confidence}%`, icon: Zap, color: "#eab308" },
            { label: t("app.pages.alertCenter.priority"), value: alert.priority, icon: Globe, color: "#3b82f6" },
          ].map(({ label, value, icon: Icon, color: c }) => (
            <div key={label} className="rounded-lg bg-muted/50 border border-border p-2.5 text-center">
              <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: c }} />
              <div className="text-base font-bold font-mono text-foreground">{value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>

        {/* AI Explanation */}
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="text-[10px] text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> {t("app.pages.alertCenter.explanation")}
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{alert.explanation}</p>
        </div>

        {/* Affected countries/regions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {t("app.pages.alertCenter.countries")}
            </div>
            <div className="flex flex-wrap gap-1">
              {alert.affectedCountries.length > 0 ? alert.affectedCountries.map((c) => (
                <button
                  key={c}
                  onClick={() => void navigate({ to: "/country/$name", params: { name: c } })}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground/80 transition-colors"
                >
                  {c}
                </button>
              )) : <span className="text-[10px] text-muted-foreground">{t("app.pages.alertCenter.notSpecified")}</span>}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" /> {t("app.pages.alertCenter.regions")}
            </div>
            <div className="flex flex-wrap gap-1">
              {alert.affectedRegions.length > 0 ? alert.affectedRegions.map((r) => (
                <span key={r} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-foreground/80">
                  {r}
                </span>
              )) : <span className="text-[10px] text-muted-foreground">{t("app.pages.alertCenter.notSpecified")}</span>}
            </div>
          </div>
        </div>

        {/* Supporting sources */}
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> {t("app.pages.alertCenter.supportingSources", { count: alert.sourceCount })}
          </div>
          <div className="flex flex-wrap gap-1">
            {alert.providers.map((p) => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground capitalize">
                {p.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline of supporting events */}
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {t("app.pages.alertCenter.relatedEvents", { count: sortedEvents.length })}
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {sortedEvents.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-md bg-muted/40 border border-border/60 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-foreground truncate">{e.title}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5" suppressHydrationWarning>
                    {e.provider} · {new Date(e.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{e.riskScore}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge graph link */}
        <button
          onClick={() => void navigate({ to: "/knowledge-graph" })}
          className="w-full flex items-center justify-center gap-2 text-[11px] rounded-lg py-2 bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary transition-colors"
        >
          <Network className="w-3.5 h-3.5" />
          {t("app.pages.alertCenter.viewConnections")}
        </button>
      </div>
    </div>
  );
}
