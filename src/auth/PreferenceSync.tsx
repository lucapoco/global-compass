/**
 * PreferenceSync — restore language (and related prefs) after login.
 * Runs once per authenticated session; guests keep local locale.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";
import { getPreferences } from "@/services/personalizationService";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function PreferenceSync() {
  const { isAuthenticated, user, loading } = useAuth();
  const { locale, setLocale } = useI18n();
  const appliedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !isAuthenticated || !user?.id || !isSupabaseConfigured()) {
      if (!isAuthenticated) appliedForUser.current = null;
      return;
    }
    if (appliedForUser.current === user.id) return;

    let cancelled = false;
    void getPreferences()
      .then((prefs) => {
        if (cancelled || !prefs) return;
        appliedForUser.current = user.id;
        if (prefs.language && prefs.language !== locale) {
          setLocale(prefs.language);
        }
      })
      .catch(() => {
        /* preferences table may not be migrated yet */
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, loading, locale, setLocale]);

  return null;
}
