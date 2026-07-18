import type { ReactNode } from "react";

interface PageHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHero({
  title,
  subtitle,
  icon,
  badges,
  actions,
  className = "",
}: PageHeroProps) {
  return (
    <header
      className={[
        "page-hero",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-primary">
                {icon}
              </span>
            )}
            <h1 className="text-heading-l md:text-heading-xl tracking-tight">{title}</h1>
          </div>
          {subtitle && (
            <p className="max-w-2xl text-body-s text-muted-foreground md:text-body">{subtitle}</p>
          )}
          {badges && (
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}
