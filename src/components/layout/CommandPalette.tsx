/**
 * CommandPalette — Global Pulse command center.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search, LayoutDashboard, Newspaper, BookMarked, BarChart2,
  GitCompareArrows, FileText, Sparkles, Map, Flag, Activity,
  CloudSun, AlertTriangle, Bookmark, Info, Presentation,
  Brain, Globe2, ChevronRight, Command,
} from "lucide-react";
import { useT } from "@/i18n";

type PaletteCategory = "navigate" | "action" | "askAi";

interface PaletteCommand {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  category: PaletteCategory;
  shortcut?: string;
  action: (close: () => void) => void;
}

function buildCommands(
  navigate: ReturnType<typeof useNavigate>,
  openAIWith: (prompt: string) => void,
  t: (key: string) => string,
): PaletteCommand[] {
  const nav = (to: string) => (close: () => void) => {
    close();
    void navigate({ to } as Parameters<typeof navigate>[0]);
  };

  const cmd = (id: string, icon: React.ElementType, category: PaletteCategory, action: PaletteCommand["action"], shortcut?: string) => ({
    id,
    label: t(`app.shell.commandPalette.commands.${id}.label`),
    sublabel: t(`app.shell.commandPalette.commands.${id}.sublabel`),
    icon,
    category,
    shortcut,
    action,
  });

  const aiPromptIds = ["situation", "risks", "quakes", "regions", "cyber", "climate"] as const;

  return [
    cmd("dashboard", LayoutDashboard, "navigate", nav("/dashboard"), "Alt+1"),
    cmd("intelligence", Newspaper, "navigate", nav("/intelligence"), "Alt+2"),
    cmd("watchlist", BookMarked, "navigate", nav("/watchlist"), "Alt+3"),
    cmd("analytics", BarChart2, "navigate", nav("/analytics"), "Alt+4"),
    cmd("compare", GitCompareArrows, "navigate", nav("/compare"), "Alt+5"),
    cmd("reports", FileText, "navigate", nav("/reports"), "Alt+6"),
    cmd("aiNews", Sparkles, "navigate", nav("/ai-news"), "Alt+7"),
    cmd("map", Map, "navigate", nav("/map"), "Alt+8"),
    cmd("countries", Flag, "navigate", nav("/countries")),
    cmd("earthquakes", Activity, "navigate", nav("/earthquakes")),
    cmd("weather", CloudSun, "navigate", nav("/weather")),
    cmd("alerts", AlertTriangle, "navigate", nav("/alerts")),
    cmd("saved", Bookmark, "navigate", nav("/saved")),
    cmd("presentation", Presentation, "navigate", nav("/presentation")),
    cmd("about", Info, "navigate", nav("/about")),
    cmd("openGlobe", Globe2, "action", nav("/map")),
    cmd("genReport", FileText, "action", nav("/reports")),
    ...aiPromptIds.map((id) => {
      const label = t(`app.shell.commandPalette.aiPrompts.${id}`);
      return {
        id: `ai-${id}`,
        label,
        sublabel: t("app.shell.commandPalette.askAiSuffix"),
        icon: Brain,
        category: "askAi" as const,
        action: (close: () => void) => {
          close();
          openAIWith(label);
          void navigate({ to: "/ai-news" });
        },
      };
    }),
  ];
}

function categoryStyle(cat: PaletteCategory) {
  if (cat === "action") return { text: "text-amber-400", bg: "bg-amber-500/10  border-amber-500/20" };
  if (cat === "askAi") return { text: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" };
  return { text: "text-primary", bg: "bg-primary/10    border-primary/20" };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenAIWith?: (prompt: string) => void;
}

export function CommandPalette({ open, onClose, onOpenAIWith }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openAIWith = useMemo(() => onOpenAIWith ?? (() => {}), [onOpenAIWith]);
  const commands = useMemo(
    () => buildCommands(navigate, openAIWith, t),
    [navigate, openAIWith, t],
  );

  const categoryLabels: Record<PaletteCategory, string> = {
    navigate: t("app.shell.commandPalette.categories.navigate"),
    action: t("app.shell.commandPalette.categories.action"),
    askAi: t("app.shell.commandPalette.categories.askAi"),
  };

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [
        ...commands.filter((c) => c.category === "navigate").slice(0, 6),
        ...commands.filter((c) => c.category === "action"),
        ...commands.filter((c) => c.category === "askAi").slice(0, 3),
      ];
    }
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.sublabel?.toLowerCase().includes(q) ||
          categoryLabels[c.category].toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, commands, categoryLabels]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((v) => Math.min(v + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((v) => Math.max(v - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        results[selected]?.action(onClose);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, onClose]);

  if (!open) return null;

  const groups = (["navigate", "action", "askAi"] as const)
    .map((cat) => ({ cat, items: results.filter((r) => r.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-background/70 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("app.shell.commandPalette.aria")}
    >
      <div
        className="glass-card w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.shell.commandPalette.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            aria-label={t("app.shell.commandPalette.searchAria")}
            aria-autocomplete="list"
            aria-controls="command-palette-results"
          />
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="flex items-center gap-0.5 rounded border border-border/50 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </div>
        </div>

        <div
          id="command-palette-results"
          className="max-h-[56vh] overflow-y-auto"
          role="listbox"
          aria-label={t("app.shell.commandPalette.resultsAria")}
        >
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t("app.shell.commandPalette.emptyTitle", { query })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {t("app.shell.commandPalette.emptyHint")}
              </p>
            </div>
          ) : (
            <div className="py-1.5">
              {groups.map(({ cat, items }) => {
                const { text } = categoryStyle(cat);
                return (
                  <div key={cat}>
                    <div className="px-3 py-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${text}`}>
                        {categoryLabels[cat]}
                      </span>
                    </div>
                    <ul>
                      {items.map((cmd) => {
                        const globalIdx = results.indexOf(cmd);
                        const isSelected = globalIdx === selected;
                        const Icon = cmd.icon;
                        const { bg } = categoryStyle(cmd.category);
                        return (
                          <li key={cmd.id} role="option" aria-selected={isSelected}>
                            <button
                              type="button"
                              className={[
                                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-75",
                                isSelected
                                  ? "bg-primary/8 text-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              ].join(" ")}
                              onMouseEnter={() => setSelected(globalIdx)}
                              onClick={() => cmd.action(onClose)}
                              aria-label={cmd.label}
                            >
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${bg}`}>
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium leading-snug">{cmd.label}</div>
                                {cmd.sublabel && (
                                  <div className="truncate text-[11px] text-muted-foreground/60">{cmd.sublabel}</div>
                                )}
                              </div>
                              {cmd.shortcut && (
                                <kbd className="shrink-0 rounded border border-border/50 bg-secondary/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                                  {cmd.shortcut}
                                </kbd>
                              )}
                              {isSelected && (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5 text-[10px] text-muted-foreground/60">
          <span>{t("app.shell.commandPalette.footerBrand")}</span>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-border/40 px-1 font-mono">↑↓</kbd>{" "}
              {t("app.shell.commandPalette.navigate")}
            </span>
            <span>
              <kbd className="rounded border border-border/40 px-1 font-mono">↵</kbd>{" "}
              {t("app.shell.commandPalette.select")}
            </span>
            <span>
              <kbd className="rounded border border-border/40 px-1 font-mono">Esc</kbd>{" "}
              {t("app.shell.commandPalette.close")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
