import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { FEATURE_ITEMS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function FeaturesSection() {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="features"
      label={t("features.label")}
      title={t("features.title")}
      description={t("features.description")}
      className="bg-background py-24 md:py-32"
    >
      <FadeInView stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_ITEMS.map(({ id, icon: Icon, href }, i) => (
          <FadeInItem key={id} index={i}>
            <Link to={href} className="block h-full group">
              <GlassCard hover className="h-full p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-sky-100 text-primary shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {t(`features.items.${id}.title`)}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`features.items.${id}.description`)}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("common.explore")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </GlassCard>
            </Link>
          </FadeInItem>
        ))}
      </FadeInView>
    </SectionShell>
  );
}
