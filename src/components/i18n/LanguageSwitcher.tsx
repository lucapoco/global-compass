import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALES, useI18n, type Locale } from "@/i18n";
import { useAuth } from "@/auth";
import { updatePreferences } from "@/services/personalizationService";

interface LanguageSwitcherProps {
  className?: string;
  /** Sidebar variant uses full width trigger */
  variant?: "navbar" | "sidebar";
}

export function LanguageSwitcher({ className, variant = "navbar" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const current = LOCALES.find((l) => l.code === locale)!;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  const select = (code: Locale) => {
    setLocale(code);
    if (isAuthenticated) {
      void updatePreferences({ language: code }).catch(() => {
        /* local locale still applied */
      });
    }
    close();
  };

  const isSidebar = variant === "sidebar";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          "lang-switcher-trigger inline-flex h-10 items-center gap-2 rounded-full",
          isSidebar ? "w-full justify-between px-3" : "px-3.5",
          "border border-white/60 bg-white/55 backdrop-blur-md shadow-sm",
          "text-sm font-medium text-foreground",
          "transition-all duration-200 ease-out",
          "hover:bg-white/75 hover:border-white/80 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
          open && "bg-white/80 border-primary/25 shadow-md",
          isSidebar && "border-border/60 bg-secondary/10 hover:bg-primary/5 hover:border-primary/30",
        )}
        aria-label={t("language.select")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">{current.flag}</span>
          <span className="tabular-nums">{t(current.shortKey)}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label={t("language.select")}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute z-[60] min-w-[168px] overflow-hidden rounded-xl",
              "border border-white/60 bg-white/90 backdrop-blur-xl shadow-lg",
              isSidebar ? "left-0 right-0 bottom-[calc(100%+8px)]" : "right-0 top-[calc(100%+8px)]",
            )}
          >
            {LOCALES.map(({ code, flag, labelKey }) => {
              const selected = locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors duration-150",
                    "hover:bg-primary/5 focus-visible:outline-none focus-visible:bg-primary/8",
                    selected && "bg-primary/10 text-foreground font-medium",
                  )}
                  onClick={() => select(code)}
                >
                  <span aria-hidden="true">{flag}</span>
                  <span className="flex-1">{t(labelKey)}</span>
                  {selected && (
                    <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
