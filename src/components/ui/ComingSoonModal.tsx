/**
 * ComingSoonModal — premium gate for unfinished features.
 * Does not navigate; shows a clear "Coming Soon" message.
 */
import { X } from "lucide-react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional feature-specific title override */
  title?: string;
  description?: string;
}

export function ComingSoonModal({ open, onClose, title, description }: Props) {
  const t = useT();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_20px_60px_rgba(15,23,42,0.15)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("app.ui.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border bg-gradient-to-br from-amber-50/90 via-sky-50/60 to-card px-6 pb-5 pt-7">
          <div className="mb-2 inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            {t("app.comingSoon.badge")}
          </div>
          <h2 id="coming-soon-title" className="text-xl font-semibold tracking-tight text-foreground">
            {title ?? t("app.comingSoon.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description ?? t("app.comingSoon.description")}
          </p>
        </div>

        <div className="px-6 py-5">
          <Button type="button" className="h-11 w-full rounded-xl" onClick={onClose}>
            {t("app.comingSoon.gotIt")}
          </Button>
        </div>
      </div>
    </div>
  );
}
