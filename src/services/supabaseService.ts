import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { formatSupabaseTableError } from "@/lib/supabaseSetupHints";
import type {
  SavedCountry,
  SavedAlert,
  FeedbackMessage,
  ProjectLog,
  SavedIntelligence,
  IntelligenceItem,
  GeneratedReport,
  ReportType,
} from "@/types";
import { getSupabaseViteEnvSummary, SAVED_DATA_DEBUG_TABLES, type SavedDataDebugTable } from "@/lib/supabaseEnv";

export { isSupabaseConfigured };

export type SavedTableCountRow = { table: SavedDataDebugTable; count: number | null; error?: string };

/** Exact row counts from the active Supabase project (PostgREST `count` + `head`). */
export async function countRowsInSavedDataTables(): Promise<SavedTableCountRow[]> {
  const out: SavedTableCountRow[] = [];
  for (const table of SAVED_DATA_DEBUG_TABLES) {
    const { error, count } = await (supabase as any).from(table).select("*", { count: "exact", head: true });
    out.push({
      table,
      count: error ? null : count ?? 0,
      error: error ? formatSupabaseTableError(error.message) : undefined,
    });
  }
  return out;
}

/** Used by Saved page "Test connection" — returns counts and human-readable status. */
export async function testSupabaseSavedDataConnection(): Promise<{
  ok: boolean;
  projectRef: string | null;
  url: string;
  keyLength: number;
  rows: SavedTableCountRow[];
  message: string;
}> {
  const meta = getSupabaseViteEnvSummary();
  if (!meta.url || !meta.keyConfigured) {
    return {
      ok: false,
      projectRef: null,
      url: meta.url,
      keyLength: meta.keyLength,
      rows: [],
      message: "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart `npm run dev`.",
    };
  }
  const rows = await countRowsInSavedDataTables();
  const errors = rows.filter((r) => r.error);
  const ok = errors.length === 0;
  return {
    ok,
    projectRef: meta.projectRef,
    url: meta.url,
    keyLength: meta.keyLength,
    rows,
    message: ok
      ? `OK · project ref ${meta.projectRef ?? "(unparsed host)"}`
      : errors.map((e) => `${e.table}: ${e.error}`).join(" · "),
  };
}

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

  // ---- Saved intelligence
  async listSavedIntelligence(): Promise<SavedIntelligence[]> {
    const { data, error } = await (supabase as any)
      .from("saved_intelligence")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedIntelligence[];
  },
  async saveIntelligence(item: IntelligenceItem) {
    const payload = {
      title: item.title,
      description: item.description,
      category: item.category,
      severity: item.severity,
      country: item.country ?? null,
      source: item.source,
      url: item.url ?? null,
      image_url: item.imageUrl ?? null,
      published_at: item.publishedAt,
    };
    const { error } = await (supabase as any).from("saved_intelligence").insert(payload);
    if (error) throw error;
    await logAction("save_intelligence", item.title);
  },
  async deleteSavedIntelligence(id: string, title?: string) {
    const { error } = await (supabase as any).from("saved_intelligence").delete().eq("id", id);
    if (error) throw error;
    await logAction("delete_intelligence", title ?? id);
  },

  // ---- Generated reports
  async listGeneratedReports(): Promise<GeneratedReport[]> {
    const { data, error } = await (supabase as any)
      .from("generated_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as GeneratedReport[];
  },
  async saveGeneratedReport(payload: {
    title: string;
    type: ReportType;
    country?: string | null;
    event_id?: string | null;
    content: string;
    data_status: string;
  }) {
    const { data, error } = await (supabase as any)
      .from("generated_reports")
      .insert({
        title: payload.title,
        type: payload.type,
        country: payload.country ?? null,
        event_id: payload.event_id ?? null,
        content: payload.content,
        data_status: payload.data_status,
      })
      .select()
      .single();
    if (error) throw error;
    await logAction("save_report", payload.title);
    return data as GeneratedReport;
  },
  async deleteGeneratedReport(id: string, title?: string) {
    const { error } = await (supabase as any).from("generated_reports").delete().eq("id", id);
    if (error) throw error;
    await logAction("delete_report", title ?? id);
  },

  /** Persist AI analyst Q&A when `ai_briefings` table exists in Supabase. */
  async saveAIBriefing(payload: { question: string; answer: string; data_status?: string }) {
    const { error } = await (supabase as any).from("ai_briefings").insert({
      question: payload.question,
      answer: payload.answer,
      data_status: payload.data_status ?? null,
    });
    if (error) throw error;
    await logAction("save_ai_briefing", payload.question.slice(0, 120));
  },

  countSavedDataDebugTableRows: countRowsInSavedDataTables,
  testSavedDataConnection: testSupabaseSavedDataConnection,
};
