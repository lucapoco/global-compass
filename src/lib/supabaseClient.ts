// App Supabase client for saved data (alerts, countries, feedback, logs).
// Uses the same env vars as Lovable / Vite; do not embed keys in source.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getCredentials(): { url: string; key: string } | null {
  const url =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
    (typeof process !== "undefined" ? process.env.SUPABASE_URL?.trim() : undefined);
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY?.trim() : undefined);
  if (!url || !key) return null;
  return { url, key };
}

export const isSupabaseConfigured = (): boolean => getCredentials() !== null;

let _client: SupabaseClient<Database> | undefined;

function getClient(): SupabaseClient<Database> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file.",
    );
  }
  if (!_client) {
    _client = createClient<Database>(creds.url, creds.key, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
