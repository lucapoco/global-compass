import { toast } from "sonner";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { useViewMode } from "@/context/ViewModeContext";
import { useT } from "@/i18n";

export function ViewModeToggle({ compact = false }: { compact?: boolean }) {
  const { viewMode, setViewMode } = useViewMode();
  const t = useT();

  function set(m: "simple" | "advanced") {
    if (m === viewMode) return;
    setViewMode(m);
    toast.success(
      m === "simple"
        ? t("app.shell.viewMode.toastSimple")
        : t("app.shell.viewMode.toastAdvanced"),
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 p-0.5"
      title={
        viewMode === "simple"
          ? t("app.shell.viewMode.simpleTooltip")
          : t("app.shell.viewMode.advancedTooltip")
      }
    >
      <button
        onClick={() => set("simple")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
          viewMode === "simple" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sparkles className="h-3 w-3" />
        {compact ? t("app.shell.viewMode.simpleShort") : t("app.shell.viewMode.simple")}
      </button>
      <button
        onClick={() => set("advanced")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
          viewMode === "advanced" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <SlidersHorizontal className="h-3 w-3" />
        {compact ? t("app.shell.viewMode.advancedShort") : t("app.shell.viewMode.advanced")}
      </button>
    </div>
  );
}
