import { AuthProvider, AuthModal, PreferenceSync } from "@/auth";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "@/alert-system/components/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ViewModeProvider } from "@/context/ViewModeContext";
import { useKeyboardShortcuts, useShortcutDefinitions } from "@/hooks/useKeyboardShortcuts";
import { DevConsoleHost } from "@/dev/DevConsole";
import { useT } from "@/i18n";
import { Keyboard, X } from "lucide-react";

function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const shortcuts = useShortcutDefinitions();

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("app.shell.shortcuts.aria")}
    >
      <div
        className="glass-card w-full max-w-md p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">{t("app.shell.shortcuts.title")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border/50 p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("app.shell.shortcuts.closeAria")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          {(["action", "navigation"] as const).map((cat) => (
            <div key={cat}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`app.shell.shortcuts.categories.${cat}`)}
              </div>
              <div className="space-y-1.5">
                {shortcuts.filter((s) => s.category === cat).map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{s.description}</span>
                    <kbd className="shrink-0 rounded border border-border/60 bg-secondary/40 px-2 py-0.5 font-mono text-[11px]">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          {t("app.shell.shortcuts.footer", { toggleKey: "?", escKey: "Esc" })}
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { showHelp, setShowHelp, showCommandPalette, setShowCommandPalette } =
    useKeyboardShortcuts();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = pathname === "/";
  const showNotificationBell = pathname !== "/mission-control" && !isLanding;

  function handleOpenAIWith(prompt: string) {
    window.dispatchEvent(
      new CustomEvent("global-pulse:ai-prompt", { detail: { text: prompt } }),
    );
  }

  if (isLanding) {
    return (
      <>
        <ErrorBoundary key={pathname} context={`Page:${pathname}`}>
          <Outlet />
        </ErrorBoundary>
        <AuthModal />
        <DevConsoleHost />
      </>
    );
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="app-main bg-background" id="main-content">
          <ErrorBoundary key={pathname} context={`Page:${pathname}`}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {showNotificationBell && <NotificationBell />}
      <ShortcutsOverlay open={showHelp} onClose={() => setShowHelp(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenAIWith={handleOpenAIWith}
      />
      <AuthModal />
      <DevConsoleHost />
    </div>
  );
}

export function AppLayout() {
  return (
    <AuthProvider>
      <PreferenceSync />
      <ViewModeProvider>
        <AppContent />
      </ViewModeProvider>
    </AuthProvider>
  );
}
