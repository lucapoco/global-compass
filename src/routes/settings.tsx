/**
 * Settings — guest-accessible preferences; cloud sync when authenticated.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, LogIn } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth";
import { useT, useI18n } from "@/i18n";
import { getPreferences, updatePreferences } from "@/services/personalizationService";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { isAuthenticated, openAuthModal, profile, loading } = useAuth();
  const [personalizedFeed, setPersonalizedFeed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    void getPreferences()
      .then((prefs) => {
        if (!prefs) return;
        setPersonalizedFeed(!!prefs.personalized_feed);
      })
      .catch(() => { /* table may not exist yet */ });
  }, [isAuthenticated]);

  async function saveCloudPrefs() {
    if (!isAuthenticated) {
      openAuthModal("sync");
      return;
    }
    setSaving(true);
    try {
      await updatePreferences({
        personalized_feed: personalizedFeed,
      });
      toast.success(t("app.pages.settings.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell space-y-6">
      <PageHero
        icon={<SettingsIcon className="h-5 w-5" />}
        title={t("app.pages.settings.title")}
        subtitle={t("app.pages.settings.subtitle")}
      />

      <section className="glass-card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground">{t("app.pages.settings.language")}</h2>
        <div className="flex gap-2">
          {(["en", "ro"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLocale(code);
                if (isAuthenticated) {
                  void updatePreferences({ language: code }).catch(() => {
                    /* local locale still applied */
                  });
                }
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                locale === code
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {code === "en" ? t("language.en") : t("language.ro")}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("app.pages.settings.cloudSync")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("app.pages.settings.cloudSyncHint")}</p>
          </div>
          {!loading && !isAuthenticated && (
            <Button size="sm" variant="outline" onClick={() => openAuthModal("sync")}>
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              {t("app.auth.signIn")}
            </Button>
          )}
        </div>

        {isAuthenticated ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("app.pages.settings.signedInAs", { email: profile?.email ?? profile?.displayName ?? "—" })}
            </p>
            <label
              className="flex items-center gap-2 text-sm text-muted-foreground"
              title={t("app.comingSoon.emailNotificationsTooltip")}
            >
              <input
                type="checkbox"
                checked={false}
                disabled
                className="rounded border-border opacity-60"
                aria-disabled="true"
              />
              <span className="flex items-center gap-2">
                {t("app.pages.settings.emailNotifications")}
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-amber-800">
                  {t("app.comingSoon.badge")}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={personalizedFeed}
                onChange={(e) => setPersonalizedFeed(e.target.checked)}
                className="rounded border-border"
              />
              {t("app.pages.settings.personalizedFeed")}
            </label>
            <Button
              size="sm"
              onClick={() => void saveCloudPrefs()}
              disabled={saving}
            >
              {t("app.ui.save")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("app.pages.settings.guestHint")}</p>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        <Link to="/about" className="text-primary hover:underline">{t("app.nav.aboutProject")}</Link>
      </div>
    </div>
  );
}
