/**
 * Auth types for Global Pulse personalization layer.
 */
import type { User, Session } from "@supabase/supabase-js";

export type AuthView = "providers" | "email" | "email-signup";

export interface AuthModalState {
  open: boolean;
  reason?: string;
  view: AuthView;
}

export interface AuthUserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  preferredLocale: "en" | "ro";
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Open the premium auth modal (optional feature reason + initial view). */
  openAuthModal: (reason?: string, view?: AuthView) => void;
  closeAuthModal: () => void;
  authModal: AuthModalState;
  setAuthView: (view: AuthView) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error?: string; signedIn?: boolean; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  /**
   * If authenticated, runs `action`. Otherwise opens the auth modal and returns false.
   */
  requireAuth: (action?: () => void | Promise<void>, reason?: string) => boolean;
  refreshProfile: () => Promise<void>;
}

/** Features that require an account */
export const AUTH_LOCKED_FEATURES = [
  "save_article",
  "reading_history",
  "collections",
  "watchlist",
  "saved_data",
  "personalized_feed",
  "notifications",
  "sync",
] as const;

export type AuthLockedFeature = (typeof AUTH_LOCKED_FEATURES)[number];
