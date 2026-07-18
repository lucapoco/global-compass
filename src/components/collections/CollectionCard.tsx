/**
 * CollectionCard — list card for a user collection.
 */
import { FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CollectionRow } from "@/services/personalizationService";
import { useT } from "@/i18n";

interface Props {
  collection: CollectionRow;
  onRename: (c: CollectionRow) => void;
  onDelete: (c: CollectionRow) => void;
}

export function CollectionCard({ collection, onRename, onDelete }: Props) {
  const t = useT();

  return (
    <li className="glass-card group flex flex-col gap-3 p-4 transition-colors hover:border-primary/25">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/5">
          <FolderOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/collections/$id"
            params={{ id: collection.id }}
            className="block truncate text-sm font-semibold text-foreground hover:text-primary"
          >
            {collection.name}
          </Link>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("app.pages.collections.articleCount", { count: collection.article_count })}
          </p>
        </div>
        <div className="relative">
          <details className="group/menu">
            <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t("app.pages.collections.actions")}</span>
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => onRename(collection)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("app.pages.collections.rename")}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-muted"
                onClick={() => onDelete(collection)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("app.ui.delete")}
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span suppressHydrationWarning>
          {t("app.pages.collections.created")}:{" "}
          {new Date(collection.created_at).toLocaleDateString()}
        </span>
        <span suppressHydrationWarning>
          {t("app.pages.collections.updated")}:{" "}
          {new Date(collection.updated_at).toLocaleDateString()}
        </span>
      </div>
    </li>
  );
}
