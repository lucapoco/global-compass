// Standalone Supabase client. Reads URL + publishable key from Vite env vars.
// Configure in Workspace Settings → Build Secrets:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";

export const isSupabaseConfigured = (): boolean => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Create a real client when configured; otherwise expose a Proxy that throws
// a clear error on first use so the app does not crash at import time.
function createStub(): SupabaseClient<Database> {
  return new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Build Secrets."
      );
    },
  });
}

export const supabase: SupabaseClient<Database> = isSupabaseConfigured()
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createStub();
