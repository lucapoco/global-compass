/**
 * IntelligenceSectorsPanel — GP-007 contribution.
 *
 * Organizes intelligence events by operational sector so operators can
 * immediately jump to the domain that matters to them, instead of scrolling
 * through a mixed feed.
 *
 * Sectors:
 *  • Conflicts — military + geopolitics/politics events
 *  • Cyber     — cyber / technology threats
 *  • Economic  — economy / energy signals
 *  • Disasters — climate / disaster / health
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Cpu, TrendingUp, AlertOctagon, ExternalLink, Eye } from "lucide-react";
import type { IntelligenceItem, Earthquake } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n";

// ─── Sector config ────────────────────────────────────────────────────────────

interface Sector {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  iconColor: string;
  categories: string[];
  accentClass: string;
}

const SECTORS: Sector[] = [
  {
    id: "conflicts",
    labelKey: "app.pages.dashboard.sectors.conflicts",
    icon: Shield,
    iconColor: "text-rose-400",
    categories: ["military", "geopolitics", "politics"],
    accentClass: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  {
    id: "cyber",
    labelKey: "app.pages.dashboard.sectors.cyber",
    icon: Cpu,
    iconColor: "text-blue-400",
    categories: ["cyber", "technology"],
    accentClass: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  {
    id: "economic",
    labelKey: "app.pages.dashboard.sectors.economic",
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    categories: ["economy", "energy", "trade"],
    accentClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  {
    id: "disasters",
    labelKey: "app.pages.dashboard.sectors.disasters",
    icon: AlertOctagon,
    iconColor: "text-amber-400",
    categories: ["disaster", "climate", "health", "earthquake", "weather"],
    accentClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
];

const SEV_COLOR: Record<string, string> = {
  critical: "text-rose-400 border-rose-500/40",
  high: "text-amber-400 border-amber-500/40",
  medium: "text-yellow-400 border-yellow-500/40",
  low: "text-emerald-400 border-emerald-500/40",
};

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  intel: IntelligenceItem[];
  quakes?: Earthquake[];
  onOpenEvent?: (item: IntelligenceItem) => void;
}

export function IntelligenceSectorsPanel({ intel, quakes = [], onOpenEvent }: Props) {
  const t = useT();
  const [activeId, setActiveId] = useState(SECTORS[0].id);
  const activeSector = SECTORS.find((s) => s.id === activeId)!;
  const sectorLabel = t(activeSector.labelKey);

  const sectorEvents = useMemo(() => {
    let items = intel.filter((i) =>
      activeSector.categories.some((cat) =>
        i.category?.toLowerCase().includes(cat),
      ),
    );

    if (activeId === "disasters" && quakes.length > 0) {
      const quakeItems: IntelligenceItem[] = quakes
        .filter((q) => q.magnitude >= 4.5)
        .map((q) => ({
          id: `quake-${q.id}`,
          title: t("app.pages.dashboard.sectors.quakeTitle", { mag: q.magnitude.toFixed(1), place: q.place }),
          description: t("app.pages.dashboard.sectors.quakeDepth", {
            depth: q.depth.toFixed(1),
            extra: q.magnitude >= 6 ? t("app.pages.dashboard.sectors.potentiallyDamaging") : "",
          }),
          category: "disaster" as string,
          severity: q.magnitude >= 6 ? "critical" : q.magnitude >= 5 ? "high" : "medium" as string,
          source: "USGS",
          country: undefined,
          url: q.url,
          publishedAt: new Date(q.time).toISOString(),
          isLive: true,
          latitude: q.latitude,
          longitude: q.longitude,
          tags: ["earthquake"],
        } as IntelligenceItem));
      items = [...quakeItems, ...items];
    }

    return [...items]
      .sort((a, b) => {
        const ds = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
        if (ds !== 0) return ds;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, 8);
  }, [intel, quakes, activeId, activeSector, t]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of SECTORS) {
      out[s.id] = intel.filter((i) =>
        s.categories.some((cat) => i.category?.toLowerCase().includes(cat)),
      ).length;
    }
    return out;
  }, [intel]);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title={t("app.pages.dashboard.sectors.title")}
        subtitle={t("app.pages.dashboard.sectors.subtitle")}
        right={
          <Link to="/intelligence" className="text-[11px] text-primary hover:underline">
            {t("app.pages.dashboard.sectors.fullFeed")}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SECTORS.map((s) => {
          const Icon = s.icon;
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? s.accentClass + " border-opacity-60"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "" : "opacity-60"}`} />
              {t(s.labelKey)}
              {counts[s.id] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    active ? "bg-background/40" : "bg-secondary/60"
                  }`}
                >
                  {counts[s.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sectorEvents.length === 0 ? (
        <EmptyState
          title={t("app.pages.dashboard.sectors.emptyTitle", { sector: sectorLabel.toLowerCase() })}
          hint={t("app.pages.dashboard.sectors.emptyHint")}
        />
      ) : (
        <div className="space-y-1.5">
          {sectorEvents.map((item) => (
            <SectorEventRow
              key={item.id}
              item={item}
              onOpen={onOpenEvent}
            />
          ))}
        </div>
      )}

      {sectorEvents.length >= 8 && (
        <div className="mt-3 flex justify-center">
          <Link
            to="/intelligence"
            className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
          >
            {t("app.pages.dashboard.sectors.seeAll", { sector: sectorLabel.toLowerCase() })}
          </Link>
        </div>
      )}
    </div>
  );
}

function SectorEventRow({
  item,
  onOpen,
}: {
  item: IntelligenceItem;
  onOpen?: (item: IntelligenceItem) => void;
}) {
  const t = useT();
  const sevColor = SEV_COLOR[item.severity] ?? "text-muted-foreground border-border/50";
  const timeStr = (() => {
    try {
      const diff = Date.now() - new Date(item.publishedAt).getTime();
      if (diff < 3_600_000) return t("app.ui.time.minutesAgo", { count: Math.round(diff / 60_000) });
      if (diff < 86_400_000) return t("app.ui.time.hoursAgo", { count: Math.round(diff / 3_600_000) });
      return t("app.ui.time.daysAgo", { count: Math.round(diff / 86_400_000) });
    } catch {
      return "";
    }
  })();

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-2 rounded-lg border border-border/40 bg-secondary/15 p-2.5 transition-colors hover:border-border/60 sm:flex-nowrap">
      <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${sevColor}`}>
        {item.severity}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="block text-left"
        >
          <div className="line-clamp-2 text-xs font-medium leading-snug hover:text-primary">
            {item.title}
          </div>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{item.source}</span>
          {item.country && <><span>·</span><span>{item.country}</span></>}
          {timeStr && <><span>·</span><span>{timeStr}</span></>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap">
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(item)}
            title={t("app.pages.dashboard.sectors.openDetails")}
            className="rounded border border-border/50 p-1 text-muted-foreground hover:text-primary"
          >
            <Eye className="h-3 w-3" />
          </button>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title={t("app.pages.dashboard.sectors.originalSource")}
            className="rounded border border-border/50 p-1 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Link
          to="/event/$id"
          params={{ id: encodeURIComponent(item.id) }}
          title={t("app.pages.dashboard.sectors.fullAnalysis")}
          className="rounded border border-primary/40 bg-primary/10 px-1.5 py-1 text-[9px] text-primary hover:bg-primary/20"
        >
          {t("app.pages.dashboard.sectors.details")}
        </Link>
      </div>
    </div>
  );
}
