/**
 * WatchlistPanel — Manage personalized watchlist entries (light theme).
 */
import { useState, useEffect, useCallback } from "react";
import { Eye, Plus, Trash2, Loader2 } from "lucide-react";
import { listWatchlist, addWatchlistEntry, removeWatchlistEntry } from "../watchlists/watchlistService";
import type { WatchlistEntry, WatchlistEntryType } from "../types";
import { useT } from "@/i18n";

const TYPE_KEYS: { value: WatchlistEntryType; labelKey: string }[] = [
  { value: "country",      labelKey: "app.ui.watchTypes.country" },
  { value: "region",       labelKey: "app.ui.watchTypes.region" },
  { value: "category",     labelKey: "app.ui.watchTypes.category" },
  { value: "topic",        labelKey: "app.ui.watchTypes.topic" },
  { value: "keyword",      labelKey: "app.ui.watchTypes.keyword" },
  { value: "organization", labelKey: "app.ui.watchTypes.organization" },
];

export function WatchlistPanel() {
  const t = useT();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<WatchlistEntryType>("country");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listWatchlist());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await addWatchlistEntry(type, value.trim());
      setValue("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await removeWatchlistEntry(id);
  }

  const placeholderExamples: Record<WatchlistEntryType, string> = {
    country: t("app.ui.watchPlaceholders.country"),
    region: t("app.ui.watchPlaceholders.region"),
    category: t("app.ui.watchPlaceholders.category"),
    topic: t("app.ui.watchPlaceholders.topic"),
    keyword: t("app.ui.watchPlaceholders.keyword"),
    organization: t("app.ui.watchPlaceholders.organization"),
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t("app.pages.alertCenter.watchlist")}</h3>
        <span className="text-[10px] text-muted-foreground">— {t("app.pages.alertCenter.watchlistHint")}</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as WatchlistEntryType)}
          className="h-9 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          {TYPE_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
          ))}
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          placeholder={t("app.ui.watchPlaceholderPrefix", { example: placeholderExamples[type] })}
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("app.pages.alertCenter.addToWatchlist")}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="panel-scroll max-h-52 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-muted-foreground">
            {t("app.pages.alertCenter.watchlistEmpty")}
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 transition-colors hover:bg-muted/70">
              <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                {entry.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{entry.label}</span>
              <button
                type="button"
                onClick={() => void handleRemove(entry.id)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                aria-label={t("app.ui.removeItem", { label: entry.label })}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
