import type { PresentationStep } from "@/data/presentationSteps";

type Props = {
  step: PresentationStep;
};

export function PresentationPreviewCard({ step }: Props) {
  const Icon = step.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${step.previewAccent} p-5`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{step.previewTitle}</div>
          <ul className="mt-3 space-y-2">
            {step.previewBullets.map((b) => (
              <li key={b} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 opacity-60">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-8 rounded-md border border-border/40 bg-secondary/30" />
        ))}
      </div>
    </div>
  );
}
