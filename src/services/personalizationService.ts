/**
 * Personalization services — authenticated-only, RLS-isolated tables.
 */
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export interface SavedArticleInput {
  article_id: string;
  article_title: string;
  article_url?: string | null;
  article_image?: string | null;
  source?: string | null;
  category?: string | null;
  summary?: string | null;
  severity?: string | null;
  country?: string | null;
  published_at?: string | null;
  metadata?: Record<string, unknown>;
}

/** @deprecated prefer SavedArticleInput field names */
export type LegacySavedArticleInput = {
  article_id: string;
  title: string;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
  image_url?: string | null;
  category?: string | null;
  severity?: string | null;
  country?: string | null;
  published_at?: string | null;
  metadata?: Record<string, unknown>;
};

export interface UserPreferences {
  language: "en" | "ro";
  theme: "light" | "dark" | "system";
  favourite_countries: string[];
  favourite_topics: string[];
  favourite_sources: string[];
  ai_preferences: Record<string, unknown>;
  email_notifications: boolean;
  push_notifications: boolean;
  personalized_feed: boolean;
  digest_frequency: "off" | "daily" | "weekly";
}

function assertConfigured() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
}

async function requireUserId(): Promise<string> {
  assertConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  return data.user.id;
}

function normalizeSaveInput(input: SavedArticleInput | LegacySavedArticleInput): SavedArticleInput {
  if ("article_title" in input) return input;
  return {
    article_id: input.article_id,
    article_title: input.title,
    article_url: input.url,
    article_image: input.image_url,
    source: input.source,
    category: input.category,
    summary: input.summary,
    severity: input.severity,
    country: input.country,
    published_at: input.published_at,
    metadata: input.metadata,
  };
}

// ── Saved articles ──────────────────────────────────────────────────────────

export async function listSavedArticles() {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("saved_articles")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveArticle(input: SavedArticleInput | LegacySavedArticleInput) {
  const userId = await requireUserId();
  const n = normalizeSaveInput(input);
  const { data, error } = await (supabase as any)
    .from("saved_articles")
    .upsert(
      {
        user_id: userId,
        article_id: n.article_id,
        article_title: n.article_title,
        article_url: n.article_url ?? null,
        article_image: n.article_image ?? null,
        source: n.source ?? null,
        category: n.category ?? null,
        summary: n.summary ?? null,
        severity: n.severity ?? null,
        country: n.country ?? null,
        published_at: n.published_at ?? null,
        metadata: n.metadata ?? {},
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeSavedArticle(articleId: string) {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("saved_articles")
    .delete()
    .eq("user_id", userId)
    .eq("article_id", articleId);
  if (error) throw error;
}

// ── Reading history ─────────────────────────────────────────────────────────

export async function listReadingHistory() {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("reading_history")
    .select("*")
    .eq("user_id", userId)
    .order("opened_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function trackReading(input: {
  article_id: string;
  title?: string;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
  category?: string | null;
  country?: string | null;
  progress_pct?: number;
}) {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("reading_history")
    .upsert(
      {
        user_id: userId,
        article_id: input.article_id,
        title: input.title ?? null,
        summary: input.summary ?? null,
        source: input.source ?? null,
        url: input.url ?? null,
        category: input.category ?? null,
        country: input.country ?? null,
        progress_pct: input.progress_pct ?? 100,
        opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearReadingHistory() {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("reading_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Preferences ─────────────────────────────────────────────────────────────

export async function getPreferences(): Promise<UserPreferences | null> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    language: data.language === "ro" ? "ro" : "en",
    theme: (["light", "dark", "system"].includes(data.theme) ? data.theme : "system") as UserPreferences["theme"],
    favourite_countries: data.favourite_countries ?? data.preferred_countries ?? [],
    favourite_topics: data.favourite_topics ?? data.preferred_categories ?? [],
    favourite_sources: data.favourite_sources ?? [],
    ai_preferences: data.ai_preferences ?? {},
    email_notifications: !!data.email_notifications,
    push_notifications: !!data.push_notifications,
    personalized_feed: !!data.personalized_feed,
    digest_frequency: data.digest_frequency ?? "daily",
  };
}

export async function updatePreferences(patch: Partial<UserPreferences> & Record<string, unknown>) {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("preferences")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(patch: {
  full_name?: string;
  avatar_url?: string | null;
  preferred_language?: "en" | "ro";
  theme?: "light" | "dark" | "system";
}) {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Collections ─────────────────────────────────────────────────────────────

export interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  article_count: number;
}

export interface CollectionArticleRow {
  id: string;
  collection_id: string;
  article_id: string;
  title: string;
  url: string | null;
  source: string | null;
  added_at: string;
}

function mapCollection(row: Record<string, unknown>): CollectionRow {
  const countRaw = row.collection_articles;
  let article_count = 0;
  if (Array.isArray(countRaw) && countRaw[0] && typeof countRaw[0] === "object") {
    article_count = Number((countRaw[0] as { count?: number }).count ?? 0);
  } else if (typeof countRaw === "number") {
    article_count = countRaw;
  }
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    is_default: !!row.is_default,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    article_count,
  };
}

export async function listCollections(): Promise<CollectionRow[]> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("collections")
    .select("*, collection_articles(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCollection);
}

export async function getCollection(id: string): Promise<CollectionRow | null> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("collections")
    .select("*, collection_articles(count)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCollection(data) : null;
}

export async function createCollection(input: {
  name: string;
  description?: string;
  color?: string;
}): Promise<CollectionRow> {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("collections")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? null,
    })
    .select("*, collection_articles(count)")
    .single();
  if (error) throw error;
  return mapCollection(data);
}

export async function renameCollection(id: string, name: string): Promise<CollectionRow> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Collection name cannot be empty");
  const { data, error } = await (supabase as any)
    .from("collections")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*, collection_articles(count)")
    .single();
  if (error) throw error;
  return mapCollection(data);
}

export async function updateCollection(
  id: string,
  patch: { name?: string; description?: string | null; color?: string | null },
): Promise<CollectionRow> {
  const userId = await requireUserId();
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.color !== undefined) body.color = patch.color;
  const { data, error } = await (supabase as any)
    .from("collections")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*, collection_articles(count)")
    .single();
  if (error) throw error;
  return mapCollection(data);
}

export async function deleteCollection(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addArticleToCollection(
  collectionId: string,
  article: { article_id: string; title: string; url?: string | null; source?: string | null },
): Promise<CollectionArticleRow> {
  await requireUserId();
  const { data, error } = await (supabase as any)
    .from("collection_articles")
    .upsert(
      {
        collection_id: collectionId,
        article_id: article.article_id,
        title: article.title,
        url: article.url ?? null,
        source: article.source ?? null,
      },
      { onConflict: "collection_id,article_id" },
    )
    .select()
    .single();
  if (error) throw error;
  // bump parent updated_at
  await (supabase as any)
    .from("collections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", collectionId);
  return data as CollectionArticleRow;
}

export async function removeArticleFromCollection(
  collectionId: string,
  articleId: string,
): Promise<void> {
  await requireUserId();
  const { error } = await (supabase as any)
    .from("collection_articles")
    .delete()
    .eq("collection_id", collectionId)
    .eq("article_id", articleId);
  if (error) throw error;
  await (supabase as any)
    .from("collections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", collectionId);
}

export async function moveArticleBetweenCollections(
  articleId: string,
  fromCollectionId: string,
  toCollectionId: string,
  meta?: { title?: string; url?: string | null; source?: string | null },
): Promise<void> {
  if (fromCollectionId === toCollectionId) return;
  await requireUserId();

  // Prefer metadata from source row
  const { data: existing } = await (supabase as any)
    .from("collection_articles")
    .select("*")
    .eq("collection_id", fromCollectionId)
    .eq("article_id", articleId)
    .maybeSingle();

  const title = meta?.title ?? existing?.title ?? articleId;
  const url = meta?.url ?? existing?.url ?? null;
  const source = meta?.source ?? existing?.source ?? null;

  await addArticleToCollection(toCollectionId, {
    article_id: articleId,
    title,
    url,
    source,
  });
  await removeArticleFromCollection(fromCollectionId, articleId);
}

export async function listCollectionArticles(
  collectionId: string,
): Promise<CollectionArticleRow[]> {
  await requireUserId();
  const { data, error } = await (supabase as any)
    .from("collection_articles")
    .select("*")
    .eq("collection_id", collectionId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CollectionArticleRow[];
}

export async function listCloudNotifications() {
  const userId = await requireUserId();
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const userId = await requireUserId();
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
