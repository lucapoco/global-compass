/**
 * Saved Articles — authenticated cloud bookmarks + add to collection.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, Trash2, LogIn, ExternalLink, FolderPlus } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AddToCollectionModal, type CollectionArticlePayload } from "@/components/collections/AddToCollectionModal";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";
import { listSavedArticles, removeSavedArticle } from "@/services/personalizationService";
import { toast } from "sonner";

export const Route = createFileRoute("/saved-articles")({
  component: SavedArticlesPage,
});

type SavedRow = {
  id: string;
  article_id: string;
  article_title?: string | null;
  title?: string | null;
  article_url?: string | null;
  url?: string | null;
  article_image?: string | null;
  summary?: string | null;
  category?: string | null;
  source?: string | null;
  country?: string | null;
  saved_at?: string | null;
};

function SavedArticlesPage() {
  const t = useT();
  const { isAuthenticated, openAuthModal, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTarget, setAddTarget] = useState<CollectionArticlePayload | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      setItems((await listSavedArticles()) as SavedRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <PageHero
          icon={<Bookmark className="h-5 w-5" />}
          title={t("app.pages.savedArticles.title")}
          subtitle={t("app.pages.savedArticles.subtitle")}
        />
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{t("app.auth.gate.savedArticles")}</p>
          <Button onClick={() => openAuthModal("save_article")}>
            <LogIn className="mr-1.5 h-4 w-4" />
            {t("app.auth.signIn")}
          </Button>
          <Link to="/intelligence" className="text-sm text-primary hover:underline">
            {t("app.auth.continueBrowsing")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHero
          icon={<Bookmark className="h-5 w-5" />}
          title={t("app.pages.savedArticles.title")}
          subtitle={t("app.pages.savedArticles.subtitle")}
        />
        <Button variant="outline" size="sm" asChild>
          <Link to="/collections">{t("app.nav.collections")}</Link>
        </Button>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          title={t("app.pages.savedArticles.emptyTitle")}
          hint={t("app.pages.savedArticles.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const title = item.article_title ?? item.title ?? item.article_id;
            const href = item.article_url ?? item.url;
            return (
              <li key={item.id} className="glass-card flex items-start gap-3 p-4">
                {item.article_image ? (
                  <img
                    src={item.article_image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      <span className="truncate">{title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                    </a>
                  ) : (
                    <div className="truncate text-sm font-medium text-foreground">{title}</div>
                  )}
                  {item.summary ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {item.source ? <span>{item.source}</span> : null}
                    {item.category ? <span>{item.category}</span> : null}
                    {item.country ? <span>{item.country}</span> : null}
                    {item.saved_at ? (
                      <span suppressHydrationWarning>{new Date(item.saved_at).toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() =>
                      setAddTarget({
                        article_id: item.article_id,
                        title,
                        url: href,
                        source: item.source,
                      })
                    }
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    {t("app.pages.collections.addToCollection")}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={t("app.ui.removeItem", { label: title })}
                    onClick={() => {
                      void removeSavedArticle(item.article_id)
                        .then(() => setItems((prev) => prev.filter((x) => x.id !== item.id)))
                        .catch((e) =>
                          toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")),
                        );
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddToCollectionModal
        open={!!addTarget}
        article={addTarget}
        onClose={() => setAddTarget(null)}
      />
    </div>
  );
}
