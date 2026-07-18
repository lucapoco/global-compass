/**
 * ErrorMessage — inline error state component.
 */
import { AlertCircle, RefreshCw } from "lucide-react";
import { useT } from "@/i18n";

interface Props {
  message: string;
  variant?: "inline" | "card";
  onRetry?: () => void;
}

export function ErrorMessage({ message, variant = "inline", onRetry }: Props) {
  const t = useT();

  if (variant === "card") {
    return (
      <div
        role="alert"
        className="glass-card flex flex-col items-center gap-3 border-rose-glow/25 p-8 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-glow/30 bg-rose-glow/10">
          <AlertCircle className="h-6 w-6 text-rose-glow" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t("app.errors.generic")}</p>
          <p className="text-xs text-muted-foreground max-w-[40ch]">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("app.ui.tryAgain")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-rose-glow/25 bg-rose-glow/8 px-3 py-2.5 text-sm text-rose-glow"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="leading-snug">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto shrink-0 text-rose-glow/70 hover:text-rose-glow transition-colors"
          title={t("app.ui.retry")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
