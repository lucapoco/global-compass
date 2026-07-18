/**
 * Reading History — authenticated only.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { History, LogIn, Trash2 } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/auth";
import { useT } from "@/i18n";
import { clearReadingHistory, listReadingHistory } from "@/services/personalizationService";
import { toast } from "sonner";

export const Route = createFileRoute("/reading-history")({
  component: ReadingHistoryPage,
});

type HistoryRow = {
  id: string;
  article_id: string;
  title?: string | null;
  url?: string | null;
  opened_at?: string | null;
  read_at?: string | null;
  source?: string | null;
  category?: string | null;
};

function ReadingHistoryPage() {
  const t = useT();
  const { isAuthenticated, openAuthModal, loading: authLoading } = useAuth();
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      setItems((await listReadingHistory()) as HistoryRow[]);
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
          icon={<History className="h-5 w-5" />}
          title={t("app.pages.readingHistory.title")}
          subtitle={t("app.pages.readingHistory.subtitle")}
        />
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{t("app.auth.gate.readingHistory")}</p>
          <Button onClick={() => openAuthModal("reading_history")}>
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
          icon={<History className="h-5 w-5" />}
          title={t("app.pages.readingHistory.title")}
          subtitle={t("app.pages.readingHistory.subtitle")}
        />
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void clearReadingHistory()
                .then(() => setItems([]))
                .catch((e) =>
                  toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")),
                );
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t("app.pages.readingHistory.clear")}
          </Button>
        )}
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          title={t("app.pages.readingHistory.emptyTitle")}
          hint={t("app.pages.readingHistory.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const opened = item.opened_at ?? item.read_at;
            const href = typeof item.url === "string" ? item.url : null;
            const title = item.title ?? item.article_id;
            return (
              <li key={item.id} className="glass-card p-4">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {title}
                  </a>
                ) : (
                  <div className="text-sm font-medium text-foreground">{title}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  {item.source ? <span>{item.source}</span> : null}
                  {item.category ? <span>{item.category}</span> : null}
                  {opened ? (
                    <span suppressHydrationWarning>{new Date(opened).toLocaleString()}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
