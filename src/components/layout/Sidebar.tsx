/**
 * Sidebar — original grouped navigation with auth-gated cloud items.
 * Auth UI lives in SidebarAuthFooter; nav config stays in navConfig.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Keyboard, Lock, Search } from "lucide-react";
import { ViewModeToggle } from "./ViewModeToggle";
import { SidebarAuthFooter } from "./SidebarAuthFooter";
import { openCommandPalette } from "@/hooks/useKeyboardShortcuts";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { APP_NAV_GROUPS, useT } from "@/i18n";
import { useAuth } from "@/auth";

export function Sidebar() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, openAuthModal } = useAuth();

  return (
    <aside
      data-sidebar
      className="sticky top-0 hidden h-screen min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-card lg:flex"
      aria-label={t("app.nav.mainAria")}
    >
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-4">
        <Link to="/" className="min-w-0 transition-opacity hover:opacity-90">
          <BrandLogo variant="navbar" theme="light" size={42} wordmarkAlways />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={t("app.nav.platformAria")}>
        {APP_NAV_GROUPS.map((group, gi) => (
          <div key={group.labelKey} className={gi > 0 ? "mt-4" : ""}>
            <div className="mb-1 px-2">
              <span className="select-none text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t(group.labelKey)}
              </span>
            </div>

            <ul role="list" className="space-y-0.5">
              {group.items.map((item) => {
                const active = path === item.to;
                const Icon = item.icon;
                const locked = !!item.requiresAuth && !isAuthenticated;

                if (locked) {
                  return (
                    <li key={item.to}>
                      <button
                        type="button"
                        onClick={() => openAuthModal(item.authReason ?? "sync")}
                        className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground/70 transition-colors duration-[120ms] hover:bg-muted hover:text-foreground"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                        <span className="flex-1 truncate text-left">{t(item.labelKey)}</span>
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-[120ms]",
                        active
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon
                        className={[
                          "h-4 w-4 shrink-0 transition-colors duration-[120ms]",
                          active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/80",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                      {item.badgeKey && (
                        <span className="ml-auto rounded-md border border-border/60 bg-secondary/80 px-1.5 py-px text-[8px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                          {t(item.badgeKey)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border/40 px-3 py-3">
        <SidebarAuthFooter />

        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t("app.nav.openCommandPalette")}
          className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-secondary/10 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <span className="flex-1">{t("app.nav.searchCommand")}</span>
          <kbd className="rounded border border-border/50 bg-secondary/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">
            ⌘K
          </kbd>
        </button>

        <ViewModeToggle />
        <LanguageSwitcher variant="sidebar" className="w-full" />

        <div className="flex select-none items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <Keyboard className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{t("app.nav.pressForShortcuts")}</span>
          <kbd className="kbd">?</kbd>
          <span>{t("app.nav.forShortcuts")}</span>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground/40">
          {t("app.nav.projectCredit")}
        </p>
      </div>
    </aside>
  );
}
