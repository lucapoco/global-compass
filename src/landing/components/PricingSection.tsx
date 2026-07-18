import { useState } from "react";
import { Check } from "lucide-react";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { LandingButton } from "./ui/LandingButton";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { PRICING_TIER_IDS } from "../constants/content";
import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { ComingSoonModal } from "@/components/ui/ComingSoonModal";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  onEnterDashboard: () => void;
}

export function PricingSection({ onEnterDashboard }: Props) {
  const { t, dict } = useLandingI18n();
  const appT = useT();
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonTier, setComingSoonTier] = useState<"professional" | "enterprise" | null>(null);

  function openComingSoon(tier: "professional" | "enterprise") {
    setComingSoonTier(tier);
    setComingSoonOpen(true);
  }

  const modalTitle =
    comingSoonTier === "enterprise"
      ? appT("app.comingSoon.enterpriseTitle")
      : appT("app.comingSoon.professionalTitle");

  const modalDescription =
    comingSoonTier === "enterprise"
      ? appT("app.comingSoon.enterpriseDescription")
      : appT("app.comingSoon.professionalDescription");

  return (
    <SectionShell
      id="pricing"
      label={t("pricing.label")}
      title={t("pricing.title")}
      description={t("pricing.description")}
      className="py-24 md:py-32 bg-muted/30"
    >
      <FadeInView stagger className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIER_IDS.map((id, i) => {
          const tier = dict.pricing.tiers[id];
          const isCommunity = id === "community";
          const isComingSoon = id === "professional" || id === "enterprise";

          return (
            <FadeInItem key={id} index={i}>
              <GlassCard
                hover={!isComingSoon}
                glow={isCommunity}
                className={cn(
                  "relative flex h-full flex-col p-8",
                  isCommunity && "border-primary/30 ring-1 ring-primary/20",
                  isComingSoon && "opacity-95",
                )}
              >
                {isCommunity && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    ⭐ {t("pricing.mostPopular")}
                  </span>
                )}
                {isComingSoon && (
                  <span
                    className="absolute right-4 top-4 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-800"
                    title={
                      id === "professional"
                        ? appT("app.comingSoon.professionalTooltip")
                        : appT("app.comingSoon.enterpriseTooltip")
                    }
                  >
                    {appT("app.comingSoon.badge")}
                  </span>
                )}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                  {tier.period ? (
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isComingSoon ? (
                  <LandingButton
                    className="mt-8 w-full cursor-not-allowed opacity-70"
                    variant="outline"
                    glow={false}
                    aria-disabled="true"
                    title={
                      id === "professional"
                        ? appT("app.comingSoon.professionalTooltip")
                        : appT("app.comingSoon.enterpriseTooltip")
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openComingSoon(id);
                    }}
                  >
                    {appT("app.comingSoon.badge")}
                  </LandingButton>
                ) : (
                  <LandingButton
                    className="mt-8 w-full"
                    variant="default"
                    glow
                    onClick={onEnterDashboard}
                  >
                    {tier.cta}
                  </LandingButton>
                )}
              </GlassCard>
            </FadeInItem>
          );
        })}
      </FadeInView>

      <ComingSoonModal
        open={comingSoonOpen}
        onClose={() => setComingSoonOpen(false)}
        title={modalTitle}
        description={modalDescription}
      />
    </SectionShell>
  );
}
