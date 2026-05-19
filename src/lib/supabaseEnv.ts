/**
 * Supabase project identity from Vite env only (no process.env fallbacks).
 * Used for debug UI and fingerprinting; keep in sync with `supabaseClient.ts`.
 */

export function getViteSupabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
}

export function getViteSupabasePublishableKey(): string {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";
}

/** Parses `https://<ref>.supabase.co` → project ref, or null if not a standard Supabase host. */
export function extractSupabaseProjectRef(url: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function getSupabaseViteEnvSummary() {
  const url = getViteSupabaseUrl();
  const key = getViteSupabasePublishableKey();
  return {
    url,
    projectRef: extractSupabaseProjectRef(url),
    keyConfigured: key.length > 0,
    keyLength: key.length,
    envSource: "VITE" as const,
  };
}

/** Tables the Saved Data page and related flows read/write (excluding optional `user_feedback`). */
export const SAVED_DATA_DEBUG_TABLES = [
  "saved_countries",
  "saved_alerts",
  "saved_intelligence",
  "project_logs",
] as const;

export type SavedDataDebugTable = (typeof SAVED_DATA_DEBUG_TABLES)[number];
