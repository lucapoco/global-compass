/** Turns PostgREST / Postgres errors into short setup hints (no secrets). */
export function supabaseAccessSetupHint(message: string): string | undefined {
  const m = message.toLowerCase();
  if (/does not exist|schema cache|pgrst205/i.test(message)) {
    return "Create tables: run `supabase-schema.sql` in Supabase → SQL Editor.";
  }
  if (/permission denied|rls|policy|42501/i.test(m)) {
    return "RLS blocked this table: run the RLS block at the bottom of `supabase-schema.sql` (policies for `anon`).";
  }
  if (/jwt|invalid api key|apikey/i.test(m)) {
    return "Check `VITE_SUPABASE_PUBLISHABLE_KEY` is the Project API **anon** `public` key.";
  }
  return undefined;
}

export function formatSupabaseTableError(message: string): string {
  const hint = supabaseAccessSetupHint(message);
  return hint ? `${message} — ${hint}` : message;
}
