import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { LandingButton } from "./ui/LandingButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { NAV_LINKS } from "../constants/content";
import { useLandingI18n } from "../i18n/LandingI18nProvider";
import { cn } from "@/lib/utils";

interface Props {
  onEnterDashboard: () => void;
}

export function LandingNav({ onEnterDashboard }: Props) {
  const { t } = useLandingI18n();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 pt-4 md:px-6">
      <nav
        className={cn(
          "mx-auto flex max-w-6xl items-center gap-2 rounded-2xl px-4 py-3 md:px-6 transition-all duration-300",
          scrolled
            ? "landing-nav-glass border border-white/50 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl bg-white/75"
            : "bg-transparent border border-transparent",
        )}
        aria-label={t("nav.mainAria")}
      >
        <Link to="/" className="shrink-0 mr-auto lg:mr-0" aria-label={t("nav.homeAria")}>
          <BrandLogo variant="navbar" theme="light" size={44} interactive />
        </Link>

        <ul className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {NAV_LINKS.map(({ key, href }) => (
            <li key={href}>
              <a
                href={href}
                className="rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-white/50"
              >
                {t(`nav.${key}`)}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher />

          <div className="hidden lg:flex items-center gap-2">
            <LandingButton variant="ghost" size="sm" asChild>
              <Link to="/map">{t("nav.exploreMap")}</Link>
            </LandingButton>
            <LandingButton size="sm" glow onClick={onEnterDashboard}>
              {t("nav.openDashboard")}
            </LandingButton>
          </div>

          <button
            type="button"
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-white/60 text-foreground"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="lg:hidden mx-auto mt-2 max-w-6xl rounded-2xl border border-white/50 bg-white/90 backdrop-blur-xl p-4 shadow-xl"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map(({ key, href }) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={closeMobile}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60"
                >
                  {t(`nav.${key}`)}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <LandingButton variant="outline" asChild className="w-full">
              <Link to="/map" onClick={closeMobile}>{t("nav.exploreMap")}</Link>
            </LandingButton>
            <LandingButton glow className="w-full" onClick={() => { closeMobile(); onEnterDashboard(); }}>
              {t("nav.openDashboard")}
            </LandingButton>
          </div>
        </motion.div>
      )}
    </header>
  );
}
