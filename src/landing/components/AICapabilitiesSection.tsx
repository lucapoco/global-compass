import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { LandingButton } from "./ui/LandingButton";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { AI_CAPABILITY_ITEMS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function AICapabilitiesSection() {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="ai"
      label={t("ai.label")}
      title={t("ai.title")}
      description={t("ai.description")}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 landing-ai-gradient pointer-events-none" aria-hidden="true" />

      <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
        <FadeInView className="space-y-6">
          <GlassCard className="p-8 space-y-4">
            <div className="rounded-2xl bg-slate-900 p-5 font-mono text-[13px] leading-relaxed text-slate-100 shadow-inner">
              <p className="text-sky-400 mb-2">{t("ai.demoLabel")}</p>
              <p className="text-slate-300">{t("ai.demoQuote")}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t("ai.demoCaption")}</p>
            <LandingButton glow asChild>
              <Link to="/ai-news" className="gap-2">
                {t("ai.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </LandingButton>
          </GlassCard>
        </FadeInView>

        <FadeInView stagger className="grid gap-4 sm:grid-cols-2">
          {AI_CAPABILITY_ITEMS.map(({ id, icon: Icon }, i) => (
            <FadeInItem key={id} index={i}>
              <GlassCard hover className="p-6 h-full">
                <Icon className="h-5 w-5 text-primary mb-3" aria-hidden="true" />
                <h3 className="font-semibold tracking-tight">{t(`ai.items.${id}.title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {t(`ai.items.${id}.description`)}
                </p>
              </GlassCard>
            </FadeInItem>
          ))}
        </FadeInView>
      </div>
    </SectionShell>
  );
}
