// Standalone Supabase client pointing at the user's own Supabase project.
// We bypass the Lovable Cloud managed client (src/integrations/supabase/client.ts)
// because the user wants to use their external Supabase project instead.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://hwkirweisjfkucytlxlt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B7b7BSDUeNMRmZ3N7lzluA_effstGxP";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isSupabaseConfigured = (): boolean => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
