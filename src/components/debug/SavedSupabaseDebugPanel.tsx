import { getSupabaseViteEnvSummary, SAVED_DATA_DEBUG_TABLES } from "@/lib/supabaseEnv";
import type { SavedTableCountRow } from "@/services/supabaseService";

interface Props {
  /** ISO string from parent after each list refresh */
  lastRefreshIso: string | null;
  /** Row counts from last probe (same Supabase project as lists) */
  tableCounts: SavedTableCountRow[] | null;
}

export function SavedSupabaseDebugPanel({ lastRefreshIso, tableCounts }: Props) {
  const meta = getSupabaseViteEnvSummary();

  return (
    <div className="glass-card border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
      <div className="mb-2 font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        Dev · Supabase source audit
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Supabase URL</dt>
          <dd className="break-all font-mono text-[11px] text-foreground">{meta.url || "(empty)"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Project ref</dt>
          <dd className="font-mono text-foreground">{meta.projectRef ?? "(could not parse host)"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Publishable key</dt>
          <dd className="text-foreground">
            {meta.keyConfigured ? `configured · length ${meta.keyLength}` : "not set"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Env source</dt>
          <dd className="text-foreground">{meta.envSource} (import.meta.env only)</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Tables queried</dt>
          <dd className="font-mono text-[11px] text-foreground">{SAVED_DATA_DEBUG_TABLES.join(", ")}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Row counts (PostgREST head count)</dt>
          <dd>
            {tableCounts == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                {tableCounts.map((t) => (
                  <li key={t.table}>
                    <span className="text-foreground">{t.table}</span>
                    {": "}
                    {t.error ? <span className="text-rose-500">{t.error}</span> : <span>{t.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Last list refresh</dt>
          <dd className="text-foreground">{lastRefreshIso ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Use header buttons &quot;Test Supabase connection&quot; / &quot;Refresh Supabase data&quot; to probe and reload. Restart Vite after changing `.env`.
      </p>
    </div>
  );
}
