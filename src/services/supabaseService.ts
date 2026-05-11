import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { SavedCountry, SavedAlert, FeedbackMessage, ProjectLog } from "@/types";

export { isSupabaseConfigured };

async function logAction(action: string, details?: string) {
  try {
    await supabase.from("project_logs").insert({ action, details: details ?? null });
  } catch (e) {
    console.warn("project_logs insert failed", e);
  }
}

export const supabaseService = {
  // ---- Saved countries
  async listSavedCountries(): Promise<SavedCountry[]> {
    const { data, error } = await supabase
      .from("saved_countries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedCountry[];
  },
  async saveCountry(payload: Omit<SavedCountry, "id" | "created_at">) {
    const { error } = await supabase.from("saved_countries").insert(payload);
    if (error) throw error;
    await logAction("save_country", payload.country_name);
  },
  async deleteSavedCountry(id: string, name?: string) {
    const { error } = await supabase.from("saved_countries").delete().eq("id", id);
    if (error) throw error;
    await logAction("delete_country", name ?? id);
  },

  // ---- Saved alerts
  async listSavedAlerts(): Promise<SavedAlert[]> {
    const { data, error } = await supabase
      .from("saved_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedAlert[];
  },
  async saveAlert(payload: Omit<SavedAlert, "id" | "created_at">) {
    const { error } = await supabase.from("saved_alerts").insert(payload);
    if (error) throw error;
    await logAction("save_alert", payload.title);
  },
  async deleteSavedAlert(id: string, title?: string) {
    const { error } = await supabase.from("saved_alerts").delete().eq("id", id);
    if (error) throw error;
    await logAction("delete_alert", title ?? id);
  },

  // ---- Feedback
  async submitFeedback(payload: { name?: string | null; message: string; rating?: number | null }) {
    const { error } = await supabase.from("user_feedback").insert(payload);
    if (error) throw error;
    await logAction("submit_feedback", payload.name ?? "anonymous");
  },

  // ---- Logs
  async listLogs(): Promise<ProjectLog[]> {
    const { data, error } = await supabase
      .from("project_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as ProjectLog[];
  },

  // ---- Feedback list (for "About")
  async listFeedback(): Promise<FeedbackMessage[]> {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as FeedbackMessage[];
  },
};
