/**
 * AddToCollectionModal — pick or create a collection for an article.
 */
import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import {
  addArticleToCollection,
  createCollection,
  listCollections,
  type CollectionRow,
} from "@/services/personalizationService";

export interface CollectionArticlePayload {
  article_id: string;
  title: string;
  url?: string | null;
  source?: string | null;
}

interface Props {
  open: boolean;
  article: CollectionArticlePayload | null;
  onClose: () => void;
  onAdded?: (collection: CollectionRow) => void;
}

export function AddToCollectionModal({ open, article, onClose, onAdded }: Props) {
  const t = useT();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCollections(await listCollections());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setNewName("");
    setCreating(false);
    void load();
  }, [open, load]);

  if (!open || !article) return null;

  async function addTo(collection: CollectionRow) {
    setBusyId(collection.id);
    try {
      await addArticleToCollection(collection.id, article!);
      toast.success(t("app.pages.collections.addedToast", { name: collection.name }));
      onAdded?.(collection);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusyId("__create__");
    try {
      const col = await createCollection({ name });
      await addArticleToCollection(col.id, article!);
      toast.success(t("app.pages.collections.addedToast", { name: col.name }));
      onAdded?.(col);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-collection-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("app.ui.close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border px-5 pb-4 pt-5">
          <h2 id="add-to-collection-title" className="text-lg font-semibold text-foreground">
            {t("app.pages.collections.addToTitle")}
          </h2>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.title}</p>
        </div>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto p-3">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("app.ui.loading")}</p>
          ) : collections.length === 0 && !creating ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("app.pages.collections.emptyHint")}
            </p>
          ) : (
            collections.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!!busyId}
                onClick={() => void addTo(c)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {c.name}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {t("app.pages.collections.articleCount", { count: c.article_count })}
                </span>
                {busyId === c.id ? (
                  <span className="text-[10px] text-muted-foreground">{t("app.ui.loading")}</span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border p-3">
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createAndAdd();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder={t("app.pages.collections.newPlaceholder")}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                type="button"
                size="sm"
                disabled={!newName.trim() || !!busyId}
                onClick={() => void createAndAdd()}
              >
                {t("app.pages.collections.create")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("app.pages.collections.createNew")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
