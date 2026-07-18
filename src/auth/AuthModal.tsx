/**
 * AuthModal — premium gate for cloud / personalization features.
 */
import { useState } from "react";
import { Github, Loader2, Mail, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useT } from "@/i18n";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M6.6 14.3l-.8.6-2.3 1.8C5.1 19.5 8.3 21.4 12 21.4c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.5z" />
      <path fill="#4A90E2" d="M3.5 7.3C2.8 8.7 2.4 10.3 2.4 12s.4 3.3 1.1 4.7l3.1-2.4c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.5 7.3z" />
      <path fill="#FBBC05" d="M12 5.2c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 2.5 14.4 1.6 12 1.6 8.3 1.6 5.1 3.5 3.5 7.3l3.1 2.4C7.9 6.7 9.8 5.2 12 5.2z" />
    </svg>
  );
}

export function AuthModal() {
  const t = useT();
  const {
    authModal, closeAuthModal, setAuthView,
    signInWithGoogle, signInWithGitHub,
    signInWithEmail, signUpWithEmail,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!authModal.open) return null;

  const configured = isSupabaseConfigured();

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setBusy(true);
    try {
      if (provider === "google") await signInWithGoogle();
      else await signInWithGitHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("app.auth.errors.generic"));
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (authModal.view === "email-signup") {
        const res = await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);
        if (res.error) setError(res.error);
        else setInfo(t("app.auth.checkEmail"));
      } else {
        const res = await signInWithEmail(email.trim(), password);
        if (res.error) setError(res.error);
        else closeAuthModal();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_20px_60px_rgba(15,23,42,0.15)]">
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("app.ui.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border bg-gradient-to-br from-primary/8 via-sky-50/80 to-card px-6 pb-5 pt-7">
          <h2 id="auth-modal-title" className="text-xl font-semibold tracking-tight text-foreground">
            {authModal.reason === "save_article"
              ? t("app.auth.modal.saveTitle")
              : t("app.auth.modal.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {authModal.reason === "save_article"
              ? t("app.auth.modal.saveDescription")
              : t("app.auth.modal.description")}
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {!configured && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("app.auth.supabaseNotConfigured")}
            </div>
          )}

          {authModal.view === "providers" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-3 rounded-xl"
                disabled={busy || !configured}
                onClick={() => void handleOAuth("google")}
              >
                <GoogleIcon className="h-5 w-5" />
                {t("app.auth.continueGoogle")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-3 rounded-xl"
                disabled={busy || !configured}
                onClick={() => void handleOAuth("github")}
              >
                <Github className="h-5 w-5" />
                {t("app.auth.continueGitHub")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start gap-3 rounded-xl"
                disabled={busy || !configured}
                onClick={() => setAuthView("email")}
              >
                <Mail className="h-5 w-5 text-primary" />
                {t("app.auth.continueEmail")}
              </Button>
              <button
                type="button"
                onClick={closeAuthModal}
                className="mt-1 w-full py-2 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("app.auth.continueBrowsing")}
              </button>
            </>
          )}

          {(authModal.view === "email" || authModal.view === "email-signup") && (
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
              {authModal.view === "email-signup" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="auth-name">
                    {t("app.auth.displayName")}
                  </label>
                  <input
                    id="auth-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="auth-email">
                  {t("app.auth.email")}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="auth-password">
                  {t("app.auth.password")}
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  autoComplete={authModal.view === "email-signup" ? "new-password" : "current-password"}
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
              {info && <p className="text-xs text-emerald-700">{info}</p>}

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy || !configured}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {authModal.view === "email-signup" ? t("app.auth.createAccount") : t("app.auth.signIn")}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setAuthView("providers")}
                >
                  {t("app.auth.back")}
                </button>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setAuthView(authModal.view === "email" ? "email-signup" : "email")}
                >
                  {authModal.view === "email" ? t("app.auth.needAccount") : t("app.auth.haveAccount")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
