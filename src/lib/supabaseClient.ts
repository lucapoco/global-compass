// App Supabase client — single source of truth for saved data (alerts, countries, intelligence, logs).
// Credentials: **only** `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
// (no hardcoded URLs/keys, no `process.env` fallbacks, no Lovable-managed defaults).
//
// After changing `.env` or `.env.local`, restart Vite (Ctrl+C → `npm run dev`) and hard-refresh the browser,
// or `import.meta.env` may still point at the previous Supabase project.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractSupabaseProjectRef, getViteSupabasePublishableKey, getViteSupabaseUrl } from "./supabaseEnv";

function getCredentials(): { url: string; key: string } | null {
  const url = getViteSupabaseUrl();
  const key = getViteSupabasePublishableKey();
  if (!url || !key) return null;
  return { url, key };
}

export const isSupabaseConfigured = (): boolean => getCredentials() !== null;

let _client: SupabaseClient<Database> | undefined;
/** Fingerprint so the client recreates when URL or publishable key changes. */
let _clientFingerprint: string | undefined;

function getClient(): SupabaseClient<Database> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env and restart the dev server.",
    );
  }
  const fingerprint = `${creds.url}\n${creds.key}`;
  if (_client && _clientFingerprint === fingerprint) return _client;

  _clientFingerprint = fingerprint;
  const ref = extractSupabaseProjectRef(creds.url) ?? "unknown";
  _client = createClient<Database>(creds.url, creds.key, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // Dedicated `/auth/callback` exchanges the PKCE code. Auto-detect would race
      // with that exchange and often break Google / GitHub sign-in ("code already used").
      detectSessionInUrl: false,
      flowType: "pkce",
      // Isolate auth storage per Supabase project so switching `VITE_SUPABASE_URL` does not reuse old session keys.
      storageKey: `gc-sb-${ref}-auth`,
    },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
