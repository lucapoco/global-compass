/**
 * Collection detail — articles inside one collection.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  FolderInput,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";
import { sanitizeUrl } from "@/lib/utils";
import {
  getCollection,
  listCollectionArticles,
  listCollections,
  moveArticleBetweenCollections,
  removeArticleFromCollection,
  type CollectionArticleRow,
  type CollectionRow,
} from "@/services/personalizationService";

export const Route = createFileRoute("/collections/$id")({
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { id } = Route.useParams();
  const t = useT();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [collection, setCollection] = useState<CollectionRow | null>(null);
  const [articles, setArticles] = useState<CollectionArticleRow[]>([]);
  const [otherCollections, setOtherCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<CollectionArticleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [col, arts, all] = await Promise.all([
        getCollection(id),
        listCollectionArticles(id),
        listCollections(),
      ]);
      setCollection(col);
      setArticles(arts);
      setOtherCollections(all.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove() {
    if (!removeTarget) return;
    setBusy(true);
    const articleId = removeTarget.article_id;
    const prev = articles;
    setArticles((list) => list.filter((a) => a.article_id !== articleId));
    try {
      await removeArticleFromCollection(id, articleId);
      setRemoveTarget(null);
      toast.success(t("app.pages.collections.removedArticleToast"));
      const refreshed = await getCollection(id);
      if (refreshed) setCollection(refreshed);
    } catch (e) {
      setArticles(prev);
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(article: CollectionArticleRow, toId: string) {
    const prev = articles;
    setArticles((list) => list.filter((a) => a.article_id !== article.article_id));
    try {
      await moveArticleBetweenCollections(article.article_id, id, toId, {
        title: article.title,
        url: article.url,
        source: article.source,
      });
      toast.success(t("app.pages.collections.movedToast"));
      const refreshed = await getCollection(id);
      if (refreshed) setCollection(refreshed);
    } catch (e) {
      setArticles(prev);
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    }
  }

  if (authLoading || loading) return <LoadingSpinner />;

  if (!isAuthenticated || !collection) {
    return (
      <div className="page-shell">
        <EmptyState
          title={t("app.pages.collections.notFoundTitle")}
          hint={t("app.pages.collections.notFoundHint")}
        />
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link to="/collections">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("app.pages.collections.back")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/collections"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("app.pages.collections.back")}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FolderOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            {collection.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("app.pages.collections.articleCount", { count: articles.length })}
          </p>
        </div>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          title={t("app.pages.collections.emptyArticlesTitle")}
          hint={t("app.pages.collections.emptyArticlesHint")}
        />
      ) : (
        <ul className="space-y-2">
          {articles.map((article) => {
            const href = sanitizeUrl(article.url);
            return (
              <li key={article.id} className="glass-card flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      <span className="truncate">{article.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                    </a>
                  ) : (
                    <div className="truncate text-sm font-medium">{article.title}</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {article.source ? <span>{article.source}</span> : null}
                    <span suppressHydrationWarning>
                      {new Date(article.added_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {otherCollections.length > 0 && (
                    <details className="relative">
                      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                        <FolderInput className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">{t("app.pages.collections.move")}</span>
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-md">
                        {otherCollections.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-muted"
                            onClick={() => void handleMove(article, c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={t("app.ui.removeItem", { label: article.title })}
                    onClick={() => setRemoveTarget(article)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title={t("app.pages.collections.removeArticleTitle")}
        description={t("app.pages.collections.removeArticleDescription")}
        confirmLabel={t("app.ui.delete")}
        cancelLabel={t("app.ui.cancel")}
        destructive
        busy={busy}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}
