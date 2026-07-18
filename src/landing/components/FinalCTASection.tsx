import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { LandingButton } from "./ui/LandingButton";
import { AnimatedGradientBg } from "./ui/AnimatedGradientBg";
import { FadeInView } from "./ui/FadeInView";
import { useLandingT } from "../i18n/LandingI18nProvider";

interface Props {
  onEnterDashboard: () => void;
  exiting?: boolean;
}

export function FinalCTASection({ onEnterDashboard, exiting = false }: Props) {
  const { t } = useLandingT();

  return (
    <section className="relative py-32 md:py-40 px-6 overflow-hidden" aria-labelledby="final-cta-heading">
      <AnimatedGradientBg />
      <div className="relative mx-auto max-w-3xl text-center">
        <FadeInView>
          <motion.div
            animate={exiting ? { scale: 1.15, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 id="final-cta-heading" className="landing-section-title text-4xl md:text-5xl">
              {t("finalCta.title")}
            </h2>
            <p className="landing-section-desc mx-auto mt-5 max-w-xl">{t("finalCta.description")}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <LandingButton size="xl" glow className="gap-2 px-10" onClick={onEnterDashboard}>
                {t("finalCta.cta")}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </LandingButton>
            </div>
          </motion.div>
        </FadeInView>
      </div>
    </section>
  );
}
