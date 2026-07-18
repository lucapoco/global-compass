/**
 * WidgetContainer — Reusable shell for Mission Control widgets (light theme).
 */
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useT } from "@/i18n";

interface Props {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  statusDot?: "green" | "amber" | "red" | "blue" | "none";
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  presentationMode?: boolean;
  /** Optional accent for status-critical widgets (ignored visually in light mode beyond dot) */
  glowColor?: string;
}

const DOT_CLASS = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red:   "bg-red-500",
  blue:  "bg-primary",
  none:  "hidden",
};

export function WidgetContainer({
  title, icon, children, className = "",
  statusDot = "none", actions, loading, error, compact, presentationMode,
}: Props) {
  const t = useT();
  const pad = compact ? "p-3" : "p-4";

  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white",
        "shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200",
        "hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-[#CBD5E1]",
        className,
      ].join(" ")}
    >
      <div className={`flex items-center gap-2 border-b border-[#E2E8F0]/80 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        {icon && (
          <span className={`shrink-0 text-primary ${presentationMode ? "h-5 w-5" : "h-4 w-4"}`}>
            {icon}
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate font-semibold tracking-tight text-[#0F172A] ${
          presentationMode ? "text-sm" : "text-xs"
        }`}>
          {title}
        </span>

        {statusDot !== "none" && (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[statusDot]}`} />
        )}

        {actions && (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>

      <div className={`relative min-h-0 flex-1 ${pad}`}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-primary" />
              <span className="text-[10px] text-[#64748B]">{t("app.pages.missionControl.loading")}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[10px]">{error}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-md p-1 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-primary disabled:opacity-50"
      aria-label={t("app.ui.refresh")}
    >
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
