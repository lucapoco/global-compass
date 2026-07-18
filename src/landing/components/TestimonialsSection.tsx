import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { TESTIMONIAL_ITEMS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function TestimonialsSection() {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="testimonials"
      label={t("testimonials.label")}
      title={t("testimonials.title")}
      description={t("testimonials.description")}
      className="py-24 md:py-32 bg-muted/30"
    >
      <FadeInView stagger className="grid gap-6 md:grid-cols-3">
        {TESTIMONIAL_ITEMS.map(({ id, name }, i) => (
          <FadeInItem key={id} index={i}>
            <GlassCard hover className="p-8 h-full flex flex-col">
              <blockquote className="flex-1 text-[15px] leading-relaxed text-foreground/90">
                &ldquo;{t(`testimonials.items.${id}.quote`)}&rdquo;
              </blockquote>
              <footer className="mt-6 pt-6 border-t border-border/60">
                <cite className="not-italic">
                  <div className="font-semibold text-foreground">{name}</div>
                  <div className="text-sm text-muted-foreground">{t(`testimonials.items.${id}.role`)}</div>
                  <div className="text-xs text-muted-foreground/80 mt-0.5">{t(`testimonials.items.${id}.org`)}</div>
                </cite>
              </footer>
            </GlassCard>
          </FadeInItem>
        ))}
      </FadeInView>
    </SectionShell>
  );
}
