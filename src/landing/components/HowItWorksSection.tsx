import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { HOW_IT_WORKS_STEPS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function HowItWorksSection() {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="how-it-works"
      label={t("howItWorks.label")}
      title={t("howItWorks.title")}
      description={t("howItWorks.description")}
      className="py-24 md:py-32 bg-muted/30"
    >
      <FadeInView stagger className="grid gap-6 md:grid-cols-3">
        {HOW_IT_WORKS_STEPS.map(({ id, step, icon: Icon }, i) => (
          <FadeInItem key={id} index={i}>
            <GlassCard hover className="relative h-full p-8">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70">{step}</span>
              <div className="mt-5 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-primary border border-border/50 shadow-sm">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">{t(`howItWorks.steps.${id}.title`)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`howItWorks.steps.${id}.description`)}
              </p>
            </GlassCard>
          </FadeInItem>
        ))}
      </FadeInView>
    </SectionShell>
  );
}
