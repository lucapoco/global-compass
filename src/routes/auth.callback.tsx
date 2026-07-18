import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useT } from "@/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

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
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error(t("app.auth.errors.generic"));
          }
        }
        if (!cancelled) {
          void navigate({ to: "/dashboard", replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("app.auth.errors.generic"));
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
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => void navigate({ to: "/dashboard" })}
          >
            {t("app.shell.notFound.backToDashboard")}
          </button>
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
