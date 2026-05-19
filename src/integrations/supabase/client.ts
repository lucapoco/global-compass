/**
 * Re-export the app Supabase client — single runtime source of truth lives in `@/lib/supabaseClient`.
 * Prefer: `import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient"`.
 */
export { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
