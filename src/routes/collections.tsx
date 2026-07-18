/**
 * Collections — full CRUD list with search & sort.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen, LogIn, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";
import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
  type CollectionRow,
} from "@/services/personalizationService";

export const Route = createFileRoute("/collections")({
  component: CollectionsPage,
});

type SortMode = "newest" | "oldest" | "alpha" | "updated";

function CollectionsPage() {
  const t = useT();
  const { isAuthenticated, openAuthModal, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CollectionRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CollectionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      setItems(await listCollections());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("app.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      if (sort === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [items, query, sort]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createCollection({ name });
      setItems((prev) => [created, ...prev]);
      setNewName("");
      setCreateOpen(false);
      toast.success(t("app.pages.collections.createdToast", { name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("app.ui.saveFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setRenaming(true);
    const id = renameTarget.id;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    try {
      const updated = await renameCollection(id, name);
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setRenameTarget(null);
      toast.success(t("app.pages.collections.renamedToast"));
    } catch (err) {
      void load();
      toast.error(err instanceof Error ? err.message : t("app.ui.saveFailed"));
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const id = deleteTarget.id;
    const prev = items;
    setItems((list) => list.filter((c) => c.id !== id));
    try {
      await deleteCollection(id);
      setDeleteTarget(null);
      toast.success(t("app.pages.collections.deletedToast"));
    } catch (err) {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : t("app.ui.saveFailed"));
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <PageHero
          icon={<FolderOpen className="h-5 w-5" />}
          title={t("app.pages.collections.title")}
          subtitle={t("app.pages.collections.subtitle")}
        />
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{t("app.auth.gate.collections")}</p>
          <Button onClick={() => openAuthModal("collections")}>
            <LogIn className="mr-1.5 h-4 w-4" />
            {t("app.auth.signIn")}
          </Button>
          <Link to="/dashboard" className="text-sm text-primary hover:underline">
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
          icon={<FolderOpen className="h-5 w-5" />}
          title={t("app.pages.collections.title")}
          subtitle={t("app.pages.collections.subtitle")}
        />
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("app.pages.collections.create")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.pages.collections.searchPlaceholder")}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none"
          aria-label={t("app.pages.collections.sortLabel")}
        >
          <option value="updated">{t("app.pages.collections.sort.updated")}</option>
          <option value="newest">{t("app.pages.collections.sort.newest")}</option>
          <option value="oldest">{t("app.pages.collections.sort.oldest")}</option>
          <option value="alpha">{t("app.pages.collections.sort.alpha")}</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title={query ? t("app.pages.collections.noSearchResults") : t("app.pages.collections.emptyTitle")}
          hint={query ? undefined : t("app.pages.collections.emptyHint")}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onRename={(col) => {
                setRenameTarget(col);
                setRenameValue(col.name);
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>
      )}

      {/* Create modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">{t("app.pages.collections.create")}</h2>
            <label className="mt-4 mb-1 block text-xs text-muted-foreground" htmlFor="new-collection">
              {t("app.pages.collections.newName")}
            </label>
            <input
              id="new-collection"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("app.pages.collections.newPlaceholder")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("app.ui.cancel")}
              </Button>
              <Button type="submit" disabled={!newName.trim() || creating} loading={creating}>
                {t("app.pages.collections.create")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameTarget(null);
          }}
        >
          <form
            onSubmit={(e) => void handleRename(e)}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">{t("app.pages.collections.rename")}</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                {t("app.ui.cancel")}
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming} loading={renaming}>
                {t("app.ui.save")}
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("app.pages.collections.deleteTitle")}
        description={t("app.pages.collections.deleteDescription")}
        confirmLabel={t("app.ui.delete")}
        cancelLabel={t("app.ui.cancel")}
        destructive
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
