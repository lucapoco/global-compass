import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand";
import { FOOTER_LINK_GROUPS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

const FOOTER_GROUP_LABELS = {
  product: "footer.product",
  resources: "footer.resources",
  company: "footer.explore",
} as const;

export function LandingFooter() {
  const { t } = useLandingT();

  return (
    <footer className="border-t border-border/60 bg-white/50 backdrop-blur-sm px-6 py-16" role="contentinfo">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <BrandLogo variant="footer" theme="light" size={44} />
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("footer.tagline")}
            </p>
          </div>

          {(Object.entries(FOOTER_LINK_GROUPS) as [keyof typeof FOOTER_LINK_GROUPS, typeof FOOTER_LINK_GROUPS.product][]).map(
            ([group, links]) => (
              <div key={group}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">
                  {t(FOOTER_GROUP_LABELS[group])}
                </h3>
                <ul className="space-y-2.5">
                  {links.map(({ key, href }) => (
                    <li key={href}>
                      <Link
                        to={href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t(`footer.links.${key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground">
          <p>{t("footer.copyright")}</p>
          <p>{t("footer.status")}</p>
        </div>
      </div>
    </footer>
  );
}
