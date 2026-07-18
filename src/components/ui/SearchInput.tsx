/**
 * SearchInput — controlled text input with search icon.
 *
 * Consistent with the platform design language:
 *  • h-9 aligned with Input / Button
 *  • focus ring using --ring CSS variable
 *  • search icon left-aligned
 *  • optional clear button
 *  • keyboard: Enter → onSubmit, Escape → clear
 */
import { Search, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useT } from "@/i18n";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
  disabled = false,
  id,
  label,
}: Props) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("app.ui.searchPlaceholder");

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSubmit?.();
    if (e.key === "Escape") onChange("");
  }

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="text-label mb-1 block text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={[
            "flex h-9 w-full rounded-md border border-input bg-background",
            "pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground",
            "shadow-sm outline-none transition-[border-color,box-shadow] duration-150",
            "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-45",
          ].join(" ")}
          aria-label={label ?? resolvedPlaceholder}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
            aria-label={t("app.ui.clearSearch")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
