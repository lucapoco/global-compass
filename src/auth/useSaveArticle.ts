/**
 * useSaveArticle — gated save helper.
 * Guests see the auth modal; authenticated users persist to saved_articles.
 */
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  saveArticle,
  type LegacySavedArticleInput,
  type SavedArticleInput,
} from "@/services/personalizationService";
import { supabaseService } from "@/services/supabaseService";

type SaveInput = SavedArticleInput | LegacySavedArticleInput;

function titleOf(input: SaveInput): string {
  return "article_title" in input ? input.article_title : input.title;
}

function urlOf(input: SaveInput): string | null | undefined {
  return "article_title" in input ? input.article_url : input.url;
}

function imageOf(input: SaveInput): string | null | undefined {
  return "article_title" in input ? input.article_image : input.image_url;
}

export function useSaveArticle() {
  const { requireAuth, isAuthenticated } = useAuth();
  const t = useT();

  async function persist(input: SaveInput) {
    if (!isSupabaseConfigured()) {
      toast.error(t("app.ui.notConfigured"));
      return;
    }
    try {
      await saveArticle(input);
      try {
        await supabaseService.saveIntelligence({
          id: input.article_id,
          title: titleOf(input),
          description: input.summary ?? "",
          category: input.category ?? "general",
          severity: input.severity ?? "medium",
          country: input.country ?? "",
          source: input.source ?? "",
          url: urlOf(input) ?? "",
          image_url: imageOf(input) ?? "",
          published_at: input.published_at ?? new Date().toISOString(),
        } as never);
      } catch {
        /* legacy table optional */
      }
      toast.success(t("app.toasts.eventSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    }
  }

  function save(input: SaveInput) {
    return requireAuth(() => void persist(input), "save_article");
  }

  return { save, isAuthenticated };
}
