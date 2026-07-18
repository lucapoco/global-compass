/**
 * Mission Control workspace — per-user settings synced to Supabase.
 */
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { PresentationConfig } from "@/mission-control/types";

export interface MissionControlWorkspace {
  tracked_topics: string[];
  monitored_keywords: string[];
  watched_countries: string[];
  watched_sources: string[];
  alert_rules: unknown[];
  ai_monitoring: Record<string, unknown>;
  widgets: unknown[];
  widget_layout: Record<string, unknown>;
  filters: Record<string, unknown>;
  notification_preferences: Record<string, unknown>;
  presentation: Partial<PresentationConfig>;
}

export const DEFAULT_MC_WORKSPACE: MissionControlWorkspace = {
  tracked_topics: [],
  monitored_keywords: [],
  watched_countries: [],
  watched_sources: [],
  alert_rules: [],
  ai_monitoring: {},
  widgets: [],
  widget_layout: {},
  filters: {},
  notification_preferences: {},
  presentation: {},
};

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  return data.user.id;
}

function mapRow(row: Record<string, unknown> | null): MissionControlWorkspace {
  if (!row) return { ...DEFAULT_MC_WORKSPACE };
  return {
    tracked_topics: (row.tracked_topics as string[]) ?? [],
    monitored_keywords: (row.monitored_keywords as string[]) ?? [],
    watched_countries: (row.watched_countries as string[]) ?? [],
    watched_sources: (row.watched_sources as string[]) ?? [],
    alert_rules: (row.alert_rules as unknown[]) ?? [],
    ai_monitoring: (row.ai_monitoring as Record<string, unknown>) ?? {},
    widgets: (row.widgets as unknown[]) ?? [],
    widget_layout: (row.widget_layout as Record<string, unknown>) ?? {},
    filters: (row.filters as Record<string, unknown>) ?? {},
    notification_preferences: (row.notification_preferences as Record<string, unknown>) ?? {},
    presentation: (row.presentation as Partial<PresentationConfig>) ?? {},
  };
}

/** Load current user's Mission Control workspace (RLS-scoped). */
export async function getMissionControlWorkspace(): Promise<MissionControlWorkspace> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("mission_control_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await (supabase as any)
      .from("mission_control_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (insertError) throw insertError;
    return mapRow(created);
  }

  return mapRow(data);
}

/** Patch + upsert current user's Mission Control workspace. */
export async function updateMissionControlWorkspace(
  patch: Partial<MissionControlWorkspace>,
): Promise<MissionControlWorkspace> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("mission_control_settings")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}
