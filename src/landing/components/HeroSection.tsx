import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand";
import { LandingButton } from "./ui/LandingButton";
import { HeroBackground } from "./HeroBackground";
import { HeroVideoShowcase } from "./HeroVideoShowcase";
import { fadeUp } from "../motion/variants";
import { useLandingT } from "../i18n/LandingI18nProvider";

interface Props {
  onEnterDashboard: () => void;
}

const heroTextContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

export function HeroSection({ onEnterDashboard }: Props) {
  const { t } = useLandingT();

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-16 md:pt-32 md:pb-24 lg:pb-28"
      aria-labelledby="hero-heading"
    >
      <HeroBackground />

      <div
        className="pointer-events-none absolute right-[6%] top-[20%] hidden opacity-[0.06] xl:block"
        aria-hidden="true"
      >
        <BrandLogo variant="icon" theme="light" size={128} />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 md:gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <motion.div
          className="order-1 flex flex-col justify-center space-y-6 md:space-y-8"
          initial="hidden"
          animate="visible"
          variants={heroTextContainer}
        >
          <motion.h1
            id="hero-heading"
            variants={fadeUp}
            className="landing-hero-title max-w-xl"
          >
            {t("hero.title")}{" "}
            <span className="landing-gradient-text">{t("hero.titleHighlight")}</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="landing-hero-subtitle max-w-lg">
            {t("hero.subtitle")}
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 pt-1">
            <LandingButton size="xl" glow className="gap-2" onClick={onEnterDashboard}>
              {t("hero.ctaPrimary")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LandingButton>
            <LandingButton
              size="xl"
              variant="outline"
              className="gap-2 bg-white/50 backdrop-blur-sm"
              asChild
            >
              <Link to="/mission-control">
                <Play className="h-4 w-4" aria-hidden="true" />
                {t("hero.ctaSecondary")}
              </Link>
            </LandingButton>
          </motion.div>
        </motion.div>

        <div className="order-2 w-full">
          <HeroVideoShowcase />
        </div>
      </div>
    </section>
  );
}
