import { X } from "lucide-react";
import type { GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { DEFAULT_ENABLED_LAYER_GROUPS, LAYER_GROUPS } from "@/utils/filterEvents";
import { useT } from "@/i18n";

interface Props {
  categories: Set<GlobalEventCategory>;
  severities: GlobalEventSeverity[];
  searchQuery: string;
  enabledLayerGroups: string[];
  minRiskScore?: number;
  minConfidence?: number;
  verifiedOnly: boolean;
  liveOnly: boolean;
  onRemoveCategory: (c: GlobalEventCategory) => void;
  onRemoveSeverity: (s: GlobalEventSeverity) => void;
  onClearSearch: () => void;
  onEnableLayerGroup: (id: string) => void;
  onClearRisk: () => void;
  onClearConfidence: () => void;
  onClearVerified: () => void;
  onClearLive: () => void;
  onClearAll: () => void;
}

const CAT_LABELS: Partial<Record<GlobalEventCategory, string>> = { technology: "Tech", geopolitics: "Politics" };

export function ActiveFilterSummary({
  categories,
  severities,
  searchQuery,
  enabledLayerGroups,
  minRiskScore,
  minConfidence,
  verifiedOnly,
  liveOnly,
  onRemoveCategory,
  onRemoveSeverity,
  onClearSearch,
  onEnableLayerGroup,
  onClearRisk,
  onClearConfidence,
  onClearVerified,
  onClearLive,
  onClearAll,
}: Props) {
  const t = useT();
  const chips: React.ReactNode[] = [];

  for (const c of categories) {
    chips.push(
      <button
        key={`cat-${c}`}
        type="button"
        onClick={() => onRemoveCategory(c)}
        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
      >
        {CAT_LABELS[c] ?? c} <X className="h-3 w-3" />
      </button>,
    );
  }
  for (const s of severities) {
    chips.push(
      <button
        key={`sev-${s}`}
        type="button"
        onClick={() => onRemoveSeverity(s)}
        className="inline-flex items-center gap-1 rounded-md border border-amber-glow/40 bg-amber-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-glow"
      >
        {t("app.pages.map.ui.severityChip", { level: t(`app.ui.severity.${s}`) })} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (minRiskScore !== undefined) {
    chips.push(
      <button key="risk" type="button" onClick={onClearRisk} className="inline-flex items-center gap-1 rounded-md border border-rose-glow/40 bg-rose-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-glow">
        {t("app.pages.map.ui.riskMin")} {minRiskScore} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (minConfidence !== undefined) {
    chips.push(
      <button key="conf" type="button" onClick={onClearConfidence} className="inline-flex items-center gap-1 rounded-md border border-cyan-glow/40 bg-cyan-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-glow">
        {t("app.pages.map.ui.confidenceMin")} {minConfidence} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (verifiedOnly) {
    chips.push(
      <button key="verified" type="button" onClick={onClearVerified} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {t("app.pages.map.ui.verifiedOnly")} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (liveOnly) {
    chips.push(
      <button key="live" type="button" onClick={onClearLive} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {t("app.pages.map.ui.liveOnly")} <X className="h-3 w-3" />
      </button>,
    );
  }
  if (searchQuery.trim()) {
    chips.push(
      <button
        key="q"
        type="button"
        onClick={onClearSearch}
        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        {t("app.pages.map.ui.searchChip", { query: searchQuery.trim() })} <X className="h-3 w-3" />
      </button>,
    );
  }
  // Only flag layers the user actively turned off from their default state —
  // the many opt-in layers (Floods, Volcanoes, Economic Indicators, ...) that
  // are off by default shouldn't clutter "active filters" until touched.
  for (const group of LAYER_GROUPS) {
    const wasDefaultOn = DEFAULT_ENABLED_LAYER_GROUPS.includes(group.id);
    if (wasDefaultOn && !enabledLayerGroups.includes(group.id)) {
      chips.push(
        <button
          key={`off-${group.id}`}
          type="button"
          onClick={() => onEnableLayerGroup(group.id)}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
        >
          {t("app.pages.map.ui.layerOff", { label: group.label })} <X className="h-3 w-3" />
        </button>,
      );
    }
  }

  const extraLayersOn = enabledLayerGroups.filter((id) => !DEFAULT_ENABLED_LAYER_GROUPS.includes(id));
  if (extraLayersOn.length > 0) {
    chips.push(
      <span key="extra-layers" className="inline-flex items-center gap-1 rounded-md border border-emerald-glow/40 bg-emerald-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-glow">
        {t("app.pages.map.ui.extraLayersOn", { count: extraLayersOn.length })}
      </span>,
    );
  }

  return (
    <div className="glass-card flex flex-wrap items-center gap-1.5 p-2">
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.pages.map.ui.activeFilters")}</span>
      {chips.length === 0 ? (
        <span className="text-[10px] text-muted-foreground">{t("app.pages.map.ui.allEventsVisible")}</span>
      ) : (
        <>
          {chips}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {t("app.pages.map.ui.clearAll")}
          </button>
        </>
      )}
    </div>
  );
}
