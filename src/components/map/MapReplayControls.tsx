import { Pause, Play, RotateCcw } from "lucide-react";
import type { UseReplayResult } from "@/hooks/useReplay";
import { useT } from "@/i18n";

interface Props {
  replay: UseReplayResult;
}

/** Intelligence-replay style controls: Play / Pause / Reset / Speed / Jump-to-date. */
export function MapReplayControls({ replay }: Props) {
  const t = useT();
  const { state, play, pause, reset, setSpeed, jumpToProgress, speeds, progress } = replay;

  return (
    <div className="glass-card flex flex-wrap items-center gap-2 p-2">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.replay")}</span>
      <button
        type="button"
        onClick={() => (state.isPlaying ? pause() : play())}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
      >
        {state.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {state.isPlaying ? t("app.pages.map.ui.pause") : t("app.pages.map.ui.play")}
      </button>
      <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
        <RotateCcw className="h-3.5 w-3.5" /> {t("app.pages.map.ui.reset")}
      </button>

      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.speed")}</span>
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-md border px-2 py-0.5 text-[10px] ${
              state.speed === s ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-center gap-2 min-w-[140px]">
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Date(state.startMs).toLocaleDateString()}</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => jumpToProgress(Number(e.target.value) / 1000)}
          className="flex-1 accent-[color:var(--color-primary)]"
        />
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Date(state.endMs).toLocaleDateString()}</span>
      </div>
      <span className="whitespace-nowrap rounded-md border border-border/60 px-2 py-1 text-[10px] tabular-nums text-muted-foreground">
        {new Date(state.cursorMs).toLocaleString()}
      </span>
    </div>
  );
}
