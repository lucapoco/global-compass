/**
 * AuthProvider — Supabase session restore + OAuth / email auth.
 * Guests can use the entire app; auth unlocks persistence only.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { AuthContextValue, AuthModalState, AuthUserProfile, AuthView } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: {
  id: string;
  email: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url: string | null;
  preferred_language?: string;
  preferred_locale?: string;
  theme?: string;
} | null): AuthUserProfile | null {
  if (!row) return null;
  const lang = row.preferred_language ?? row.preferred_locale ?? "en";
  return {
    id: row.id,
    email: row.email,
    displayName: row.full_name ?? row.display_name ?? null,
    avatarUrl: row.avatar_url,
    preferredLocale: lang === "ro" ? "ro" : "en",
  };
}

function oauthRedirectTo(): string {
  if (typeof window === "undefined") return "";
  // Must match Supabase Auth → URL Configuration → Redirect URLs
  // (e.g. http://localhost:8080/auth/callback and https://www.global-pulse.app/auth/callback).
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthModalState>({
    open: false,
    view: "providers",
  });

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.id) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profiles" as never)
        .select("id, email, full_name, display_name, avatar_url, preferred_language, preferred_locale, theme")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        setProfile({
          id: user.id,
          email: user.email ?? null,
          displayName:
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email?.split("@")[0] ??
            null,
          avatarUrl:
            (user.user_metadata?.avatar_url as string | undefined) ??
            (user.user_metadata?.picture as string | undefined) ??
            null,
          preferredLocale: "en",
        });
        return;
      }
      setProfile(mapProfile(data as Parameters<typeof mapProfile>[0]));
    } catch {
      setProfile({
        id: user.id,
        email: user.email ?? null,
        displayName: user.email?.split("@")[0] ?? null,
        avatarUrl: null,
        preferredLocale: "en",
      });
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Auto-refresh: TOKEN_REFRESHED keeps session alive via supabase-js.
      // Expired / revoked sessions emit SIGNED_OUT with next === null.
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_OUT" || !next) {
        setProfile(null);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setAuthModal((m) => ({ ...m, open: false }));
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const openAuthModal = useCallback((reason?: string, view: AuthView = "providers") => {
    setAuthModal({ open: true, reason, view });
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModal((m) => ({ ...m, open: false }));
  }, []);

  const setAuthView = useCallback((view: AuthView) => {
    setAuthModal((m) => ({ ...m, view }));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
    const redirectTo = oauthRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // Let the user pick an account (sign-up and returning sign-in).
        queryParams: { prompt: "select_account" },
        // We navigate explicitly so redirect always happens (and PKCE verifier is already stored).
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("Google sign-in did not return a redirect URL");
    window.location.assign(data.url);
  }, []);

  const signInWithGitHub = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
    const redirectTo = oauthRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("GitHub sign-in did not return a redirect URL");
    window.location.assign(data.url);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) return { error: "Supabase is not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    if (!isSupabaseConfigured()) return { error: "Supabase is not configured" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: oauthRedirectTo(),
        data: displayName ? { full_name: displayName } : undefined,
      },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const requireAuth = useCallback(
    (action?: () => void | Promise<void>, reason?: string) => {
      if (user) {
        void action?.();
        return true;
      }
      openAuthModal(reason);
      return false;
    },
    [user, openAuthModal],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      isAuthenticated: !!user,
      openAuthModal,
      closeAuthModal,
      authModal,
      setAuthView,
      signInWithGoogle,
      signInWithGitHub,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      requireAuth,
      refreshProfile,
    }),
    [
      user, session, profile, loading, openAuthModal, closeAuthModal, authModal,
      setAuthView, signInWithGoogle, signInWithGitHub, signInWithEmail,
      signUpWithEmail, signOut, requireAuth, refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
