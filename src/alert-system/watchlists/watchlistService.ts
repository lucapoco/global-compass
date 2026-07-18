/**
 * Watchlist Service
 *
 * Lets users monitor countries, regions, topics, categories, keywords, and
 * organizations. Whenever a relevant event appears, a personalized
 * watchlist notification is generated.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERSISTENCE
 * ─────────────────────────────────────────────────────────────────────────
 * Watchlist entries are stored in Supabase (`user_watchlists` table) when
 * configured, following the same optional-persistence pattern used by
 * `supabaseService.ts` for other saved-data tables. When Supabase is not
 * configured, entries fall back to `localStorage` so the feature still
 * works in local/demo environments.
 *
 * Expected Supabase schema (create manually if not present):
 *   user_watchlists (
 *     id uuid primary key default gen_random_uuid(),
 *     type text not null,        -- WatchlistEntryType
 *     value text not null,
 *     label text not null,
 *     created_at timestamptz default now()
 *   )
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { WatchlistEntry, WatchlistEntryType, WatchlistMatch } from "../types";

const LOCAL_STORAGE_KEY = "global-pulse:watchlists";
const TABLE = "user_watchlists";

// ─── Local storage fallback ───────────────────────────────────────────────────

function readLocal(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: WatchlistEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  if (!isSupabaseConfigured()) return readLocal();

  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return readLocal();

    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      type: row.type,
      value: row.value,
      label: row.label,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[watchlistService] Supabase read failed, falling back to local storage", err);
    return readLocal();
  }
}

const MAX_FIELD_LEN = 200;

export async function addWatchlistEntry(
  type: WatchlistEntryType,
  value: string,
  label?: string,
): Promise<WatchlistEntry> {
  const trimmedValue = value.trim().slice(0, MAX_FIELD_LEN);
  if (!trimmedValue) throw new Error("Watchlist value cannot be empty.");

  const entry: WatchlistEntry = {
    id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value: trimmedValue,
    label: (label?.trim() || trimmedValue).slice(0, MAX_FIELD_LEN),
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const entries = [entry, ...readLocal()];
    writeLocal(entries);
    return entry;
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Authentication required");

    const { data, error } = await (supabase as any)
      .from(TABLE)
      .insert({ user_id: auth.user.id, type, value, label: entry.label })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, type: data.type, value: data.value, label: data.label, createdAt: data.created_at };
  } catch (err) {
    console.warn("[watchlistService] Supabase insert failed, saving locally instead", err);
    const entries = [entry, ...readLocal()];
    writeLocal(entries);
    return entry;
  }
}

export async function removeWatchlistEntry(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    writeLocal(readLocal().filter((e) => e.id !== id));
    return;
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    const q = (supabase as any).from(TABLE).delete().eq("id", id);
    if (auth.user) q.eq("user_id", auth.user.id);
    const { error } = await q;
    if (error) throw error;
  } catch (err) {
    console.warn("[watchlistService] Supabase delete failed, removing locally instead", err);
    writeLocal(readLocal().filter((e) => e.id !== id));
  }
}

// ─── Matching engine ──────────────────────────────────────────────────────────

function matchesEntry(entry: WatchlistEntry, event: GlobalEvent): string | null {
  const val = entry.value.toLowerCase();

  switch (entry.type) {
    case "country":
      if (event.country?.toLowerCase() === val) return `Event occurred in watched country "${entry.label}"`;
      return null;

    case "region": {
      // Region matching handled by caller (needs REGION_COUNTRIES map); fallback: match by tag
      return null;
    }

    case "category":
      if (event.category === val) return `Event matches watched category "${entry.label}"`;
      return null;

    case "topic":
    case "keyword": {
      const haystack = `${event.title} ${event.description ?? ""} ${event.tags.join(" ")}`.toLowerCase();
      if (haystack.includes(val)) return `Event mentions watched keyword "${entry.label}"`;
      return null;
    }

    case "organization": {
      const haystack = `${event.title} ${event.description ?? ""}`.toLowerCase();
      if (haystack.includes(val)) return `Event references watched organization "${entry.label}"`;
      return null;
    }

    default:
      return null;
  }
}

/**
 * Match new events against the user's watchlist. `regionCountries` should be
 * `REGION_COUNTRIES` from the Decision Support Engine so "region" entries
 * can resolve to their member countries.
 */
export function matchEventsAgainstWatchlist(
  entries: WatchlistEntry[],
  events: GlobalEvent[],
  regionCountries: Record<string, string[]> = {},
): WatchlistMatch[] {
  const matches: WatchlistMatch[] = [];

  for (const entry of entries) {
    for (const event of events) {
      if (entry.type === "region") {
        const countries = regionCountries[entry.value] ?? [];
        if (event.country && countries.some((c) => c.toLowerCase() === event.country!.toLowerCase())) {
          matches.push({ entry, event, matchReason: `Event occurred in watched region "${entry.label}"` });
        }
        continue;
      }

      const reason = matchesEntry(entry, event);
      if (reason) matches.push({ entry, event, matchReason: reason });
    }
  }

  return matches;
}
