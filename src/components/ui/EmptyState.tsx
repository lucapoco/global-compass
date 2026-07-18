/**
 * EmptyState — zero-data placeholder component.
 *
 * Used when a list, panel, or section has no content to display.
 * Always explains what's missing (title) and what the user can do (hint).
 *
 * The icon container uses a dashed border ring to signal "nothing here yet"
 * without being alarming.
 */
import type { ReactNode } from "react";

interface Props {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ title, hint, icon, action, compact = false }: Props) {
  return (
    <div
      role="status"
      aria-label={title}
      className={[
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6 px-4" : "gap-3 py-10 px-6",
      ].join(" ")}
    >
      {icon && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/20 p-3 text-muted-foreground/50">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground/80">{title}</p>
        {hint && (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[26ch] mx-auto">
            {hint}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
