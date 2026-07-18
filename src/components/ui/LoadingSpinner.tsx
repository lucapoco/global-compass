/**
 * LoadingSpinner — consistent loading indicator.
 *
 * Variants:
 *  inline  — small spinner + label on one line (default)
 *  center  — fills the parent with a vertically centered spinner
 *  overlay — semi-transparent overlay over a container
 *
 * Uses a CSS border-based spinner (no SVG) for crisp rendering at any DPI.
 */
import type { ReactNode } from "react";
import { useT } from "@/i18n";

type SpinnerVariant = "inline" | "center" | "overlay";
type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface Props {
  label?: string;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
}

const sizeMap: Record<SpinnerSize, { spinner: string; text: string }> = {
  xs: { spinner: "h-3 w-3 border",     text: "text-[10px]" },
  sm: { spinner: "h-4 w-4 border",     text: "text-xs" },
  md: { spinner: "h-5 w-5 border-2",   text: "text-sm" },
  lg: { spinner: "h-7 w-7 border-2",   text: "text-base" },
};

function Spinner({ size = "sm", label }: { size?: SpinnerSize; label?: string }) {
  const t = useT();
  const s = sizeMap[size];
  return (
    <div
      role="status"
      aria-label={label ?? t("app.ui.loadingAria")}
      className={[
        s.spinner,
        "shrink-0 rounded-full border-border border-t-primary animate-spin",
      ].join(" ")}
    />
  );
}

export function LoadingSpinner({ label, variant = "inline", size = "sm", className = "" }: Props) {
  if (variant === "center") {
    return (
      <div
        role="status"
        aria-busy="true"
        className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
      >
        <Spinner size={size === "sm" ? "md" : size} label={label} />
        {label && (
          <p className={`${sizeMap[size].text} text-muted-foreground animate-pulse`}>{label}</p>
        )}
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        role="status"
        aria-busy="true"
        className={`absolute inset-0 z-overlay flex items-center justify-center rounded-inherit bg-background/60 backdrop-blur-sm ${className}`}
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" label={label} />
          {label && <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
      </div>
    );
  }

  /* inline (default) */
  return (
    <div
      role="status"
      aria-busy="true"
      className={`flex items-center gap-2 ${className}`}
    >
      <Spinner size={size} label={label} />
      {label && (
        <span className={`${sizeMap[size].text} text-muted-foreground`}>{label}</span>
      )}
    </div>
  );
}
