import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionShell } from "./ui/SectionShell";
import { GlassCard } from "./ui/GlassCard";
import { FadeInView } from "./ui/FadeInView";
import { FAQ_ITEM_IDS } from "../constants/content";
import { useLandingT } from "../i18n/LandingI18nProvider";

export function FAQSection() {
  const { t } = useLandingT();

  return (
    <SectionShell
      id="faq"
      label={t("faq.label")}
      title={t("faq.title")}
      description={t("faq.description")}
      className="py-24 md:py-32 bg-background"
    >
      <FadeInView className="max-w-3xl mx-auto">
        <GlassCard className="p-2 md:p-4">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEM_IDS.map((id, i) => (
              <AccordionItem key={id} value={`item-${i}`} className="border-border/60 px-4">
                <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline py-5">
                  {t(`faq.items.${id}.question`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {t(`faq.items.${id}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </GlassCard>
      </FadeInView>
    </SectionShell>
  );
}
