/**
 * Watch Center cloud service — per-user watchlist synced via Supabase RLS.
 */
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export type WatchCenterType = "country" | "category" | "keyword" | "severity";

export interface WatchCenterItem {
  id: string;
  type: WatchCenterType;
  value: string;
  label: string;
  pinned: boolean;
  favorite: boolean;
  addedAt: string;
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  return data.user.id;
}

function mapRow(row: Record<string, unknown>): WatchCenterItem {
  return {
    id: String(row.id),
    type: row.type as WatchCenterType,
    value: String(row.value),
    label: String(row.label ?? row.value),
    pinned: !!row.pinned,
    favorite: !!row.favorite,
    addedAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listWatchCenterItems(): Promise<WatchCenterItem[]> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("user_watchlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addWatchCenterItem(input: {
  type: WatchCenterType;
  value: string;
  label?: string;
}): Promise<WatchCenterItem> {
  const userId = await requireUserId();
  const value = input.value.trim().slice(0, 200);
  if (!value) throw new Error("Watch value cannot be empty");

  const { data, error } = await (supabase as any)
    .from("user_watchlists")
    .upsert(
      {
        user_id: userId,
        type: input.type,
        value,
        label: (input.label?.trim() || value).slice(0, 200),
        pinned: false,
        favorite: false,
      },
      { onConflict: "user_id,type,value" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateWatchCenterItem(
  id: string,
  patch: Partial<Pick<WatchCenterItem, "pinned" | "favorite" | "label">>,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("user_watchlists")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeWatchCenterItem(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("user_watchlists")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
