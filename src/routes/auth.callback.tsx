import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useT } from "@/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function cleanAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  // Strip legacy implicit-flow hash tokens if present
  const clean = `${url.pathname}${url.search}`;
  window.history.replaceState({}, document.title, clean || "/auth/callback");
}

function oauthErrorFromUrl(url: URL): string | null {
  const description = url.searchParams.get("error_description");
  if (description) return description.replace(/\+/g, " ");
  const code = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  return code ? code.replace(/\+/g, " ") : null;
}

/** Wait until Supabase finishes auto-detect / session restore (max ~timeoutMs). */
async function waitForSession(timeoutMs = 4_000) {
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return existing.data.session;

  return new Promise<NonNullable<typeof existing.data.session> | null>((resolve) => {
    const timer = window.setTimeout(() => {
      sub.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data }) => resolve(data.session));
    }, timeoutMs);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        window.clearTimeout(timer);
        sub.subscription.unsubscribe();
        resolve(session);
      }
    });
  });
}

function AuthCallbackPage() {
  const t = useT();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError(t("app.auth.supabaseNotConfigured"));
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const url = new URL(window.location.href);

        const oauthError = oauthErrorFromUrl(url);
        if (oauthError) {
          throw new Error(oauthError);
        }

        const code = url.searchParams.get("code");

        if (code) {
          // Prefer an explicit PKCE exchange. If detectSessionInUrl already
          // consumed the code (race with AuthProvider init), fall back to session.
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            const session = await waitForSession(2_500);
            if (!session) throw exchangeError;
          }
        } else {
          // No ?code= — magic-link / hash flow / already-processed redirect.
          const session = await waitForSession(4_000);
          if (!session) {
            throw new Error(t("app.auth.errors.generic"));
          }
        }

        cleanAuthParamsFromUrl();

        if (!cancelled) {
          void navigate({ to: "/dashboard", replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          const message =
            e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
              ? (e as { message: string }).message
              : e instanceof Error
                ? e.message
                : t("app.auth.errors.generic");
          setError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
      {error ? (
        <>
          <p className="max-w-md text-center text-sm text-destructive">{error}</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            {t("app.auth.callbackHint")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => void navigate({ to: "/dashboard" })}
            >
              {t("app.shell.notFound.backToDashboard")}
            </button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => {
                setError(null);
                window.location.assign(`${window.location.origin}/dashboard`);
              }}
            >
              {t("app.auth.tryAgain")}
            </button>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("app.auth.completingSignIn")}</p>
        </>
      )}
    </div>
  );
}
