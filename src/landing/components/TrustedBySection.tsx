import { FadeInView, FadeInItem } from "./ui/FadeInView";
import { TRUSTED_BY } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function TrustedBySection() {
  const { t } = useLandingT();

  return (
    <section className="border-y border-border/60 bg-white/40 py-12 backdrop-blur-sm" aria-label={t("trustedBy.label")}>
      <div className="mx-auto max-w-6xl px-6">
        <FadeInView>
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-8">
            {t("trustedBy.label")}
          </p>
        </FadeInView>
        <FadeInView stagger className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {TRUSTED_BY.map((name, i) => (
            <FadeInItem key={name} index={i}>
              <span className="text-sm font-semibold tracking-tight text-foreground/40 hover:text-foreground/70 transition-colors select-none">
                {name}
              </span>
            </FadeInItem>
          ))}
        </FadeInView>
      </div>
    </section>
  );
}
