/**
 * Account — profile overview for authenticated users.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, LogOut, LogIn } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const t = useT();
  const { isAuthenticated, profile, user, openAuthModal, signOut, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <PageHero icon={<UserRound className="h-5 w-5" />} title={t("app.pages.account.title")} subtitle={t("app.pages.account.subtitle")} />
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("app.auth.gate.account")}</p>
          <Button onClick={() => openAuthModal()}>
            <LogIn className="mr-1.5 h-4 w-4" />
            {t("app.auth.signIn")}
          </Button>
        </div>
      </div>
    );
  }

  const initials = (profile?.displayName ?? profile?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="page-shell space-y-6">
      <PageHero icon={<UserRound className="h-5 w-5" />} title={t("app.pages.account.title")} subtitle={t("app.pages.account.subtitle")} />
      <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-foreground">{profile?.displayName ?? "—"}</div>
          <div className="truncate text-sm text-muted-foreground">{profile?.email ?? user?.email ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">{t("app.nav.settings")}</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {t("app.auth.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
