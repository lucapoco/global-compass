import { useState } from "react";
import { TIMELINE_PRESETS, type TimelineRange } from "@/domain/services/map-engine";
import { useT } from "@/i18n";

interface Props {
  value: TimelineRange;
  onChange: (range: TimelineRange) => void;
}

function chip(active: boolean) {
  return `rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
  }`;
}

/** Professional timeline — Last 6h/24h/48h/7d/30d or a custom range, filters events instantly. */
export function MapTimeline({ value, onChange }: Props) {
  const t = useT();
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.timeline")}</span>
      {TIMELINE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => {
            if (preset.id === "custom") return;
            onChange({ id: preset.id, windowMs: preset.windowMs });
          }}
          className={chip(value.id === preset.id)}
        >
          {preset.label}
        </button>
      ))}
      {value.id === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              const fromMs = e.target.value ? new Date(e.target.value).getTime() : undefined;
              onChange({ id: "custom", fromMs, toMs: value.toMs });
            }}
            className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
          />
          <span className="text-[10px] text-muted-foreground">{t("app.pages.map.ui.to")}</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              const toMs = e.target.value ? new Date(e.target.value).getTime() : undefined;
              onChange({ id: "custom", fromMs: value.fromMs, toMs });
            }}
            className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
          />
        </div>
      )}
      {value.id !== "custom" && (
        <button type="button" onClick={() => onChange({ id: "custom", fromMs: Date.now() - 7 * 86400000, toMs: Date.now() })} className={chip(false)}>
          {t("app.pages.map.ui.customRange")}
        </button>
      )}
    </div>
  );
}
