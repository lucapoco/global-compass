/**
 * Global Pulse — Series A-grade marketing landing page.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLandingT } from "./i18n/LandingI18nProvider";
import { LandingNav } from "./components/LandingNav";
import { HeroSection } from "./components/HeroSection";
import { TrustedBySection } from "./components/TrustedBySection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { ProductScreensSection } from "./components/ProductScreensSection";
import { AICapabilitiesSection } from "./components/AICapabilitiesSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { StatisticsSection } from "./components/StatisticsSection";
import { PricingSection } from "./components/PricingSection";
import { FAQSection } from "./components/FAQSection";
import { FinalCTASection } from "./components/FinalCTASection";
import { LandingFooter } from "./components/LandingFooter";
import { useLandingStats } from "./useLandingStats";

function LandingPageContent() {
  const navigate = useNavigate();
  const { t } = useLandingT();
  const stats = useLandingStats();
  const [exiting, setExiting] = useState(false);

  const enterDashboard = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => void navigate({ to: "/dashboard" }), 650);
  }, [navigate]);

  return (
    <div
      className={`landing-page min-h-screen bg-background text-foreground antialiased transition-opacity duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t("common.skipToContent")}
      </a>
      <LandingNav onEnterDashboard={enterDashboard} />

      <main id="main-content">
        <HeroSection onEnterDashboard={enterDashboard} />
        <TrustedBySection />
        <FeaturesSection />
        <HowItWorksSection />
        <ProductScreensSection events={stats.events} />
        <AICapabilitiesSection />
        <TestimonialsSection />
        <StatisticsSection stats={stats} />
        <PricingSection onEnterDashboard={enterDashboard} />
        <FAQSection />
        <FinalCTASection onEnterDashboard={enterDashboard} exiting={exiting} />
      </main>

      <LandingFooter />
    </div>
  );
}

export function LandingPage() {
  return <LandingPageContent />;
}
