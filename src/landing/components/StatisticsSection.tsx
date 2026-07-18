import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { STAT_ITEM_IDS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";
import type { LandingStats } from "../useLandingStats";

interface Props {
  stats: LandingStats;
}

const STAT_VALUES = (stats: LandingStats) => ({
  countries: { value: stats.countriesMonitored, suffix: "+" },
  events: { value: stats.activeEvents, suffix: "" },
  critical: { value: stats.criticalEvents, suffix: "" },
  earthquakes: { value: stats.earthquakes, suffix: "" },
  weather: { value: stats.weatherAlerts, suffix: "" },
  reports: { value: stats.intelligenceReports, suffix: "" },
});

export function StatisticsSection({ stats }: Props) {
  const { t } = useLandingT();
  const values = STAT_VALUES(stats);

  return (
    <SectionShell
      id="statistics"
      label={t("statistics.label")}
      title={t("statistics.title")}
      description={t("statistics.description")}
      className="py-24 md:py-32 bg-background"
    >
      <FadeInView stagger className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {STAT_ITEM_IDS.map((id, i) => {
          const { value, suffix } = values[id];
          return (
            <FadeInItem key={id} index={i}>
              <GlassCard hover className="p-6 md:p-8 text-center">
                <div className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                  {stats.loading ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <AnimatedCounter to={value} suffix={suffix} />
                  )}
                </div>
                <div className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t(`statistics.items.${id}`)}
                </div>
              </GlassCard>
            </FadeInItem>
          );
        })}
      </FadeInView>
      <p className="mt-8 text-center text-xs text-muted-foreground">{t("statistics.footnote")}</p>
    </SectionShell>
  );
}
