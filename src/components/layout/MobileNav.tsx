/**
 * MobileNav — mirrors desktop grouped sidebar (original structure + auth locks).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogIn, LogOut, Lock, UserPlus, Settings } from "lucide-react";
import { useState } from "react";
import { ViewModeToggle } from "./ViewModeToggle";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { APP_NAV_GROUPS, useT } from "@/i18n";
import { useAuth } from "@/auth";

export function MobileNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, openAuthModal, signOut, profile } = useAuth();

  function close() {
    setOpen(false);
  }

  return (
    <div
      data-mobile-nav
      className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm lg:hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" onClick={close} className="min-w-0 transition-opacity hover:opacity-90">
          <BrandLogo variant="icon" theme="light" size={40} />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ViewModeToggle compact />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav-drawer"
          aria-label={t("app.nav.mobileAria")}
          className="animate-slide-up border-t border-border/40 bg-card/40 px-4 pb-4 pt-3 backdrop-blur-xl"
        >
          <div className="space-y-4">
            {APP_NAV_GROUPS.map((group) => (
              <div key={group.labelKey}>
                <p className="mb-1.5 select-none px-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {t(group.labelKey)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => {
                    const active = path === item.to;
                    const Icon = item.icon;
                    const locked = !!item.requiresAuth && !isAuthenticated;

                    if (locked) {
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => {
                            close();
                            openAuthModal(item.authReason ?? "sync");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground/70"
                        >
                          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {t(item.labelKey)}
                          <Lock className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/30 bg-accent text-primary"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t(item.labelKey)}
                        {item.badgeKey && (
                          <span className="rounded-md border border-border/60 bg-secondary/80 px-1 text-[8px] font-semibold uppercase leading-tight text-muted-foreground">
                            {t(item.badgeKey)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-2 border-t border-border/40 pt-3">
              {isAuthenticated ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/account"
                    onClick={close}
                    className="truncate text-xs font-medium text-foreground"
                  >
                    {profile?.displayName ?? profile?.email ?? t("app.auth.account")}
                  </Link>
                  <Link
                    to="/settings"
                    onClick={close}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                  >
                    <Settings className="h-3 w-3" />
                    {t("app.nav.settings")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      void signOut();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                  >
                    <LogOut className="h-3 w-3" />
                    {t("app.auth.logout")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openAuthModal();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <LogIn className="h-3 w-3" />
                    {t("app.auth.signIn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openAuthModal(undefined, "email-signup");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary"
                  >
                    <UserPlus className="h-3 w-3" />
                    {t("app.auth.createAccount")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
