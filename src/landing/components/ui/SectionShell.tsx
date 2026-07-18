import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FadeInView } from "./FadeInView";

interface SectionShellProps {
  id?: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  label?: string;
  title: string;
  description?: string;
  centered?: boolean;
}

export function SectionShell({
  id,
  children,
  className,
  containerClassName,
  label,
  title,
  description,
  centered = true,
}: SectionShellProps) {
  return (
    <section id={id} className={cn("landing-section relative px-6", className)} aria-labelledby={id ? `${id}-heading` : undefined}>
      <div className={cn("mx-auto max-w-6xl", containerClassName)}>
        <FadeInView className={cn("mb-14 md:mb-16", centered && "text-center")}>
          {label && (
            <p className="landing-label mb-3">{label}</p>
          )}
          <h2 id={id ? `${id}-heading` : undefined} className="landing-section-title">
            {title}
          </h2>
          {description && (
            <p className={cn("landing-section-desc mt-4", centered && "mx-auto max-w-2xl")}>
              {description}
            </p>
          )}
        </FadeInView>
        {children}
      </div>
    </section>
  );
}
