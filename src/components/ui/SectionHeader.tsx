/**
 * SectionHeader — consistent in-page section title component.
 *
 * Sizes:
 *  sm  — used inside small cards / sub-sections
 *  md  — default, used in most panels (h3 semantics)
 *  lg  — page-level headings (h2 semantics)
 *
 * The `right` slot accepts any ReactNode (badges, buttons, icons).
 * The `separator` prop adds a bottom border for stronger visual separation.
 */
import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  size?: Size;
  separator?: boolean;
  className?: string;
}

const sizeMap: Record<Size, { title: string; subtitle: string; tag: "h2" | "h3" | "h4" }> = {
  lg: { title: "text-heading-l",   subtitle: "text-body-s text-muted-foreground", tag: "h2" },
  md: { title: "text-heading-s",   subtitle: "text-caption text-muted-foreground", tag: "h3" },
  sm: { title: "text-body-s font-semibold", subtitle: "text-micro text-muted-foreground", tag: "h4" },
};

export function SectionHeader({
  title,
  subtitle,
  right,
  size = "md",
  separator = false,
  className = "",
}: SectionHeaderProps) {
  const s = sizeMap[size];
  const Tag = s.tag;

  return (
    <div
      className={[
        "flex flex-wrap items-end justify-between gap-3",
        separator ? "border-b border-border/40 pb-3 mb-4" : "mb-4",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <Tag className={`${s.title} text-foreground leading-tight truncate`}>{title}</Tag>
        {subtitle && (
          <p className={`${s.subtitle} mt-0.5 line-clamp-2 leading-snug`}>{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}
