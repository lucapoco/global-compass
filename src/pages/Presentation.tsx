import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink, Presentation } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataBadge } from "@/components/ui/DataBadge";
import { Button } from "@/components/ui/button";
import { PresentationPreviewCard } from "@/components/presentation/PresentationPreviewCard";
import { PRESENTATION_STEPS } from "@/data/presentationSteps";
import { useT } from "@/i18n";

export function PresentationPage() {
  const t = useT();
  const [index, setIndex] = useState(0);
  const step = PRESENTATION_STEPS[index];
  const Icon = step.icon;
  const isFirst = index === 0;
  const isLast = index === PRESENTATION_STEPS.length - 1;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 md:p-6">
        <SectionHeader
          title={t("app.pages.presentation.title")}
          subtitle="Guided demo flow for InfoEducație jury — step through each capability, then open the live feature"
          right={<DataBadge variant="live">Jury demo</DataBadge>}
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Presentation className="h-4 w-4 text-primary" />
          Step {index + 1} of {PRESENTATION_STEPS.length}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESENTATION_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              i === index
                ? "bg-primary/15 text-primary border border-primary/30"
                : "border border-border/50 text-muted-foreground hover:text-foreground"
            }`}
            aria-current={i === index ? "step" : undefined}
          >
            {i + 1}. {s.title.split(" ").slice(0, 2).join(" ")}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{step.title}</h2>
              <p className="text-[11px] text-muted-foreground">InfoEducație · Global Pulse</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.explanation}</p>
          <Link to={step.featureTo}>
            <Button type="button" className="w-full sm:w-auto">
              <ExternalLink className="mr-2 h-4 w-4" />
              {step.featureLabel}
            </Button>
          </Link>
        </div>

        <PresentationPreviewCard step={step} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={isFirst}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1} / {PRESENTATION_STEPS.length}
        </span>
        {isLast ? (
          <Link to="/dashboard">
            <Button type="button">
              Finish demo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button type="button" onClick={() => setIndex((i) => Math.min(PRESENTATION_STEPS.length - 1, i + 1))}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
