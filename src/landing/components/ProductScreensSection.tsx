import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { PRODUCT_SCREENS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";

const LandingGlobe = lazy(() =>
  import("../LandingGlobe").then((m) => ({ default: m.LandingGlobe })),
);

interface Props {
  events: GlobalEvent[];
}

function ScreenMock({ id, gradient }: { id: string; gradient: string }) {
  if (id === "map") {
    return (
      <div className={`relative aspect-[16/10] overflow-hidden rounded-[20px] bg-gradient-to-br ${gradient}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-32 rounded-full bg-gradient-to-br from-sky-300 to-blue-600 shadow-lg opacity-90" />
        </div>
      </div>
    );
  }
  if (id === "mission") {
    return (
      <div className={`relative aspect-[16/10] overflow-hidden rounded-[20px] bg-gradient-to-br ${gradient} p-4`}>
        <div className="grid grid-cols-2 gap-2 h-full">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`relative aspect-[16/10] overflow-hidden rounded-[20px] bg-gradient-to-br ${gradient} p-4 flex items-end`}>
      <div className="flex items-end gap-1.5 w-full h-1/2">
        {[35, 55, 40, 70, 50, 85, 45, 60].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-primary/40" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ProductScreensSection({ events }: Props) {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="product"
      label={t("product.label")}
      title={t("product.title")}
      description={t("product.description")}
      className="py-24 md:py-32 bg-background"
    >
      <FadeInView className="mb-12">
        <GlassCard glow className="p-4 md:p-6">
          <Suspense
            fallback={
              <div className="flex aspect-[21/9] items-center justify-center rounded-[20px] bg-muted/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t("product.loadingGlobe")} />
              </div>
            }
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-2/5 flex justify-center">
                <LandingGlobe progress={0.65} events={events} />
              </div>
              <div className="flex-1 space-y-4 text-center md:text-left">
                <h3 className="text-2xl font-semibold tracking-tight">{t("product.globeTitle")}</h3>
                <p className="text-muted-foreground leading-relaxed">{t("product.globeDescription")}</p>
                <Link to="/map" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {t("product.openMap")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Suspense>
        </GlassCard>
      </FadeInView>

      <FadeInView stagger className="grid gap-6 md:grid-cols-3">
        {PRODUCT_SCREENS.map(({ id, href, gradient }, i) => (
          <FadeInItem key={id} index={i}>
            <Link to={href} className="block group h-full">
              <GlassCard hover className="overflow-hidden p-5 h-full">
                <ScreenMock id={id} gradient={gradient} />
                <h3 className="mt-5 text-lg font-semibold group-hover:text-primary transition-colors">
                  {t(`product.screens.${id}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`product.screens.${id}.description`)}</p>
              </GlassCard>
            </Link>
          </FadeInItem>
        ))}
      </FadeInView>
    </SectionShell>
  );
}
