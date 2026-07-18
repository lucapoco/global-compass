import { LAYER_GROUPS } from "@/utils/filterEvents";
import { useT } from "@/i18n";

interface Props {
  /** When provided, the legend only shows entries relevant to the currently-enabled layers. */
  enabledLayerGroups?: string[];
}

const LAYER_COLORS: Record<string, string> = {
  breaking_news: "#38bdf8",
  earthquakes: "#fb7185",
  wildfires: "#f97316",
  floods: "#0ea5e9",
  storms: "#a78bfa",
  weather_alerts: "#22d3ee",
  volcanoes: "#ef4444",
  humanitarian: "#facc15",
  economic: "#34d399",
  population: "#60a5fa",
  energy: "#fb923c",
  technology: "#818cf8",
  cyber: "#f472b6",
  health: "#4ade80",
  risk_index: "#f472b6",
  capitals: "#a78bfa",
  saved_alerts: "#94a3b8",
};

const SEVERITY_KEYS = ["critical", "high", "medium", "low"] as const;
const SEVERITY_COLORS: Record<(typeof SEVERITY_KEYS)[number], string> = {
  critical: "#fb7185",
  high: "#f59e0b",
  medium: "#22d3ee",
  low: "#34d399",
};

export function MapLegend({ enabledLayerGroups }: Props) {
  const t = useT();

  const activeLayers = enabledLayerGroups?.length
    ? LAYER_GROUPS.filter((g) => enabledLayerGroups.includes(g.id))
    : LAYER_GROUPS;

  return (
    <div className="glass-card flex flex-wrap items-center gap-4 p-3">
      <div className="flex flex-wrap gap-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.severityMarkerColor")}</span>
        {SEVERITY_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLORS[key], boxShadow: `0 0 8px ${SEVERITY_COLORS[key]}` }} />
            {t(`app.ui.severity.${key}`)}
          </div>
        ))}
      </div>

      <span className="hidden h-4 w-px bg-border/60 sm:inline" />

      <div className="flex flex-wrap gap-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.activeLayers")}</span>
        {activeLayers.map((l) => (
          <div key={l.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`inline-block h-2.5 w-2.5 ${l.overlayOnly ? "rounded-sm" : "rounded-full"}`}
              style={{ background: LAYER_COLORS[l.id] ?? "#94a3b8", boxShadow: `0 0 8px ${LAYER_COLORS[l.id] ?? "#94a3b8"}` }}
            />
            {l.label}
            {l.overlayOnly && <span className="text-[9px] text-muted-foreground/70">{t("app.pages.map.ui.heatmapSuffix")}</span>}
          </div>
        ))}
      </div>

      <span className="hidden h-4 w-px bg-border/60 sm:inline" />

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-primary text-[9px] font-bold text-primary-foreground">
            N
          </span>
          {t("app.pages.map.ui.clusterHint")}
        </div>
      </div>
    </div>
  );
}
