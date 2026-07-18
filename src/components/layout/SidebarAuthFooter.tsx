/**
 * SidebarAuthFooter — auth controls only (kept separate from nav).
 *
 * Guest: Sign In · Create Account
 * Auth:  Avatar · Name · Settings · Logout
 */
import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Settings, UserPlus } from "lucide-react";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";

export function SidebarAuthFooter() {
  const t = useT();
  const { isAuthenticated, profile, openAuthModal, signOut, loading } = useAuth();

  if (loading) return null;

  const initials = (profile?.displayName ?? profile?.email ?? "U").slice(0, 2).toUpperCase();

  if (!isAuthenticated) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-[120ms] hover:bg-muted hover:text-foreground"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("app.auth.signIn")}</span>
        </button>
        <button
          type="button"
          onClick={() => openAuthModal(undefined, "email-signup")}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-[120ms] hover:bg-primary/5"
        >
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("app.auth.createAccount")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link
        to="/account"
        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors duration-[120ms] hover:bg-muted"
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {profile?.displayName ?? t("app.auth.account")}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {profile?.email ?? t("app.auth.userProfile")}
          </div>
        </div>
      </Link>
      <Link
        to="/settings"
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-[120ms] hover:bg-muted hover:text-foreground"
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("app.nav.settings")}</span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-[120ms] hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("app.auth.logout")}</span>
      </button>
    </div>
  );
}
