/**
 * useKeyboardShortcuts — Global keyboard shortcut manager.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useT } from "@/i18n";

export interface ShortcutDefinition {
  keys: string;
  description: string;
  category: "navigation" | "action";
}

const ROUTES: Record<string, string> = {
  "1": "/dashboard",
  "2": "/intelligence",
  "3": "/watchlist",
  "4": "/analytics",
  "5": "/compare",
  "6": "/reports",
  "7": "/ai-news",
  "8": "/map",
};

const SHORTCUT_KEYS: { keys: string; descriptionKey: string; category: "navigation" | "action" }[] = [
  { keys: "Ctrl+K", descriptionKey: "app.shell.shortcuts.items.openCommandPalette", category: "action" },
  { keys: "Alt+1", descriptionKey: "app.shell.shortcuts.items.goDashboard", category: "navigation" },
  { keys: "Alt+2", descriptionKey: "app.shell.shortcuts.items.goIntelligence", category: "navigation" },
  { keys: "Alt+3", descriptionKey: "app.shell.shortcuts.items.goWatchCenter", category: "navigation" },
  { keys: "Alt+4", descriptionKey: "app.shell.shortcuts.items.goAnalytics", category: "navigation" },
  { keys: "Alt+5", descriptionKey: "app.shell.shortcuts.items.goCompare", category: "navigation" },
  { keys: "Alt+6", descriptionKey: "app.shell.shortcuts.items.goReports", category: "navigation" },
  { keys: "Alt+7", descriptionKey: "app.shell.shortcuts.items.goAi", category: "navigation" },
  { keys: "Alt+8", descriptionKey: "app.shell.shortcuts.items.goMap", category: "navigation" },
  { keys: "?", descriptionKey: "app.shell.shortcuts.items.showHelp", category: "action" },
  { keys: "Esc", descriptionKey: "app.shell.shortcuts.items.closeOverlay", category: "action" },
];

export function useShortcutDefinitions(): ShortcutDefinition[] {
  const t = useT();
  return useMemo(
    () => SHORTCUT_KEYS.map(({ keys, descriptionKey, category }) => ({
      keys,
      description: t(descriptionKey),
      category,
    })),
    [t],
  );
}

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (target as HTMLElement).isContentEditable
  );
}

const OPEN_PALETTE_EVENT = "global-pulse:open-command-palette";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      if (isTypingInInput(e.target)) return;

      if (e.key === "Escape") {
        setShowHelp(false);
        setShowCommandPalette(false);
        return;
      }

      if (e.key === "?" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && ROUTES[e.key]) {
        e.preventDefault();
        void navigate({ to: ROUTES[e.key] as "/" });
        return;
      }
    },
    [navigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    function onOpenPalette() {
      setShowCommandPalette(true);
    }
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onOpenPalette);
  }, []);

  return { showHelp, setShowHelp, showCommandPalette, setShowCommandPalette };
}

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

/** @deprecated Use useShortcutDefinitions() */
export const SHORTCUTS: ShortcutDefinition[] = [];
