import { toast } from "sonner";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { useViewMode } from "@/context/ViewModeContext";

export function ViewModeToggle({ compact = false }: { compact?: boolean }) {
  const { viewMode, setViewMode } = useViewMode();

  function set(m: "simple" | "advanced") {
    if (m === viewMode) return;
    setViewMode(m);
    toast.success(m === "simple" ? "Simple View enabled" : "Advanced View enabled");
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 p-0.5"
      title={viewMode === "simple" ? "Shows only the most important controls." : "Shows all filters, layers and technical tools."}
    >
      <button
        onClick={() => set("simple")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
          viewMode === "simple" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sparkles className="h-3 w-3" />{compact ? "Simple" : "Simple View"}
      </button>
      <button
        onClick={() => set("advanced")}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
          viewMode === "advanced" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <SlidersHorizontal className="h-3 w-3" />{compact ? "Advanced" : "Advanced View"}
      </button>
    </div>
  );
}
