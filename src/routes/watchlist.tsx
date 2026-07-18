/**
 * Watch Center — GP-009: Monitor specific entities.
 *
 * Route: /watchlist
 *
 * Architecture decisions:
 *  1. Persistence: watchlist items are stored in Supabase (`user_watchlists`)
 *     per authenticated user (RLS). Guests are prompted to sign in.
 *
 *  2. Data: events come from the same fetchIntelligence() + getEarthquakes()
 *     pipeline used throughout the app (shared 30-min cache).
 *
 *  3. Matching: each watchlist item defines a type + value that is matched
 *     against IntelligenceItem fields:
 *       country   → item.country (exact, case-insensitive)
 *       category  → item.category (exact, case-insensitive)
 *       keyword   → item.title or description contains value (case-insensitive)
 *       severity  → item.severity matches value
 *
 *  4. Auto-refresh: polling every 5 minutes when the page is visible.
 *
 *  Support: Add, Remove, Pin, Favorite, Filter, Sort.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked, Plus, Trash2, Pin, Star, RefreshCw, Globe2,
  Tag, AlertTriangle, Search, Eye, ExternalLink, Filter, SortAsc, LogIn,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataBadge } from "@/components/ui/DataBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { IntelligenceDetailsModal } from "@/components/intelligence/IntelligenceDetailsModal";
import { sanitizeUrl } from "@/lib/utils";
// Centralized Intelligence Store — watches now match against every active
// provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED, NASA FIRMS,
// World Bank, ...), not just GNews.
import { getLatestEvents } from "@/domain/store";
import { toIntelligenceItems } from "@/domain/adapters/legacyIntelAdapter";
import type { IntelligenceItem } from "@/types";
import { useT } from "@/i18n";
import { useAuth } from "@/auth";
import {
  addWatchCenterItem,
  listWatchCenterItems,
  removeWatchCenterItem,
  updateWatchCenterItem,
  type WatchCenterItem,
  type WatchCenterType,
} from "@/services/watchCenterService";

export const Route = createFileRoute("/watchlist")({
  head: () => ({ meta: [{ title: "Watch Center — Global Pulse" }] }),
  component: WatchlistPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchType = WatchCenterType;
type WatchlistItem = WatchCenterItem;

type SortMode = "added" | "pinned" | "alpha" | "hits";
type FilterMode = "all" | "country" | "category" | "keyword" | "severity";

// ─── Watch type config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<WatchType, { labelKey: string; placeholderKey: string; icon: React.ElementType; color: string }> = {
  country:  { labelKey: "app.pages.watchlist.typeCountry",  placeholderKey: "app.pages.watchlist.phCountry",  icon: Globe2,       color: "text-cyan-400" },
  category: { labelKey: "app.pages.watchlist.typeCategory", placeholderKey: "app.pages.watchlist.phCategory", icon: Tag,          color: "text-purple-400" },
  keyword:  { labelKey: "app.pages.watchlist.typeKeyword",  placeholderKey: "app.pages.watchlist.phKeyword",  icon: Search,       color: "text-amber-400" },
  severity: { labelKey: "app.pages.watchlist.typeSeverity", placeholderKey: "app.pages.watchlist.phSeverity", icon: AlertTriangle, color: "text-rose-400" },
};

const FILTER_LABEL_KEYS: Record<FilterMode, string> = {
  all: "app.pages.watchlist.filterAll",
  country: "app.pages.watchlist.typeCountry",
  category: "app.pages.watchlist.typeCategory",
  keyword: "app.pages.watchlist.typeKeyword",
  severity: "app.pages.watchlist.typeSeverity",
};

const SORT_LABEL_KEYS: Record<SortMode, string> = {
  added: "app.pages.watchlist.sortRecent",
  pinned: "app.pages.watchlist.filterPinned",
  alpha: "app.pages.watchlist.sortAlpha",
  hits: "app.pages.watchlist.sortHits",
};

// ─── Event matching ───────────────────────────────────────────────────────────

function matchesWatch(event: IntelligenceItem, watch: WatchlistItem): boolean {
  const val = watch.value.toLowerCase();
  switch (watch.type) {
    case "country":
      return event.country?.toLowerCase() === val;
    case "category":
      return event.category?.toLowerCase().includes(val) ?? false;
    case "keyword":
      return (
        event.title.toLowerCase().includes(val) ||
        (event.description?.toLowerCase().includes(val) ?? false)
      );
    case "severity":
      return event.severity?.toLowerCase() === val;
    default:
      return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function WatchlistPage() {
  const t = useT();
  const { isAuthenticated, openAuthModal, loading: authLoading } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [intel, setIntel] = useState<IntelligenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // watchlist item ID
  const [addType, setAddType] = useState<WatchType>("country");
  const [addValue, setAddValue] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("pinned");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [activeModal, setActiveModal] = useState<IntelligenceItem | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load per-user watchlist from Supabase
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setWatchlist([]);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void listWatchCenterItems()
      .then((items) => {
        if (!cancelled) setWatchlist(items);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : t("app.errors.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading, t]);

  // Auto-select first item when list loads/changes
  useEffect(() => {
    if (!selected && watchlist.length > 0) {
      setSelected(watchlist[0].id);
    }
  }, [watchlist, selected]);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const events = await getLatestEvents({ limit: 200, force });
      setIntel(toIntelligenceItems(events));
      setLastUpdated(new Date());
    } catch {
      toast.error(t("app.toasts.feedLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial load + auto-refresh every 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return;
    void refresh();
    pollingRef.current = setInterval(() => void refresh(), 5 * 60_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [refresh, isAuthenticated]);

  // ── Watchlist CRUD ─────────────────────────────────────────────────────────

  function addItem() {
    const val = addValue.trim();
    if (!val) { toast.error(t("app.toasts.enterWatchValue")); return; }
    if (watchlist.some((w) => w.type === addType && w.value.toLowerCase() === val.toLowerCase())) {
      toast.message(t("app.toasts.alreadyWatching")); return;
    }
    void addWatchCenterItem({ type: addType, value: val, label: val })
      .then((item) => {
        setWatchlist((prev) => [item, ...prev]);
        setSelected(item.id);
        setAddValue("");
        toast.success(t("app.toasts.watchAdded", { value: val }));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")));
  }

  function removeItem(id: string) {
    const prev = watchlist;
    setWatchlist((list) => list.filter((w) => w.id !== id));
    if (selected === id) setSelected(null);
    void removeWatchCenterItem(id)
      .then(() => toast.message(t("app.toasts.watchRemoved")))
      .catch((e) => {
        setWatchlist(prev);
        toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
      });
  }

  function togglePin(id: string) {
    const current = watchlist.find((w) => w.id === id);
    if (!current) return;
    const next = !current.pinned;
    setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, pinned: next } : w)));
    void updateWatchCenterItem(id, { pinned: next }).catch(() => {
      setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, pinned: current.pinned } : w)));
    });
  }

  function toggleFavorite(id: string) {
    const current = watchlist.find((w) => w.id === id);
    if (!current) return;
    const next = !current.favorite;
    setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, favorite: next } : w)));
    void updateWatchCenterItem(id, { favorite: next }).catch(() => {
      setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, favorite: current.favorite } : w)));
    });
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  // Hit counts per watchlist item
  const hitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of watchlist) {
      counts[w.id] = intel.filter((e) => matchesWatch(e, w)).length;
    }
    return counts;
  }, [watchlist, intel]);

  // Filtered watchlist
  const filteredWatchlist = useMemo(() => {
    let items = watchlist;
    if (filterMode !== "all") items = items.filter((w) => w.type === filterMode);
    return [...items].sort((a, b) => {
      if (sortMode === "pinned") {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      }
      if (sortMode === "hits") return (hitCounts[b.id] ?? 0) - (hitCounts[a.id] ?? 0);
      if (sortMode === "alpha") return a.label.localeCompare(b.label);
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [watchlist, filterMode, sortMode, hitCounts]);

  // Events for selected watchlist item
  const activeWatch = useMemo(
    () => filteredWatchlist.find((w) => w.id === selected),
    [filteredWatchlist, selected],
  );

  const matchingEvents = useMemo(() => {
    if (!activeWatch) return [];
    return intel
      .filter((e) => matchesWatch(e, activeWatch))
      .sort((a, b) => {
        const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const ds = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
        if (ds !== 0) return ds;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [activeWatch, intel]);

  async function onSaveItem(item: IntelligenceItem) {
    const { isSupabaseConfigured, supabaseService } = await import("@/services/supabaseService");
    if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
    try { await supabaseService.saveIntelligence(item); toast.success(t("app.toasts.eventSavedShort")); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed")); }
  }

  const TypeIcon = TYPE_CONFIG[addType].icon;

  if (authLoading || !hydrated) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <BookMarked className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">{t("app.pages.watchlist.title")}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t("app.auth.gate.watchlist")}</p>
          <Button onClick={() => openAuthModal("watchlist")}>
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
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookMarked className="h-6 w-6 text-primary" />
            {t("app.pages.watchlist.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("app.pages.watchlist.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span suppressHydrationWarning className="text-[11px] text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh(true)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("app.ui.refresh")}
          </Button>
        </div>
      </div>

      {/* ── Add new watch item ──────────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <SectionHeader title={t("app.pages.watchlist.addTitle")} subtitle={t("app.pages.watchlist.addSubtitle")} />
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Type selector */}
          {(Object.entries(TYPE_CONFIG) as [WatchType, typeof TYPE_CONFIG[WatchType]][]).map(([type, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setAddType(type)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  addType === type
                    ? `border-primary/50 bg-primary/10 ${cfg.color}`
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t(cfg.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <TypeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder={t(TYPE_CONFIG[addType].placeholderKey)}
              className="w-full rounded-lg border border-border/60 bg-background/40 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <Button onClick={addItem} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t("app.pages.watchlist.watchButton")}
          </Button>
        </div>
      </div>

      {/* ── Main: sidebar list + event feed ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left: watchlist */}
        <div className="space-y-3">
          {/* Sort + filter controls */}
          {watchlist.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "country", "category", "keyword", "severity"] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterMode(f)}
                  className={`rounded-md border px-2 py-0.5 text-[10px] capitalize ${
                    filterMode === f
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground"
                  }`}
                >
                  {t(FILTER_LABEL_KEYS[f])}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <SortAsc className="h-3.5 w-3.5 text-muted-foreground" />
                {(["pinned", "hits", "alpha", "added"] as SortMode[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSortMode(s)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] capitalize ${
                      sortMode === s
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {t(SORT_LABEL_KEYS[s])}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Watchlist items */}
          {filteredWatchlist.length === 0 ? (
            <div className="glass-card p-6">
              <EmptyState
                title={t("app.pages.watchlist.emptyListTitle")}
                hint={t("app.pages.watchlist.emptyListHint")}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredWatchlist.map((w) => {
                const cfg = TYPE_CONFIG[w.type];
                const WIcon = cfg.icon;
                const hits = hitCounts[w.id] ?? 0;
                const isSelected = selected === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelected(w.id)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/40 bg-secondary/10 hover:border-border/70"
                    }`}
                  >
                    <WIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {w.pinned && <Pin className="h-3 w-3 text-primary" />}
                        {w.favorite && <Star className="h-3 w-3 text-amber-400" />}
                        <span className="truncate text-sm font-medium">{w.label}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{t(TYPE_CONFIG[w.type].labelKey)}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        hits > 0 ? "bg-primary/20 text-primary" : "bg-secondary/40 text-muted-foreground"
                      }`}>
                        {hits}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); togglePin(w.id); }}
                          title={w.pinned ? t("app.pages.watchlist.unpin") : t("app.pages.watchlist.pin")}
                          className={`rounded p-0.5 ${w.pinned ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(w.id); }}
                          title={w.favorite ? t("app.pages.watchlist.unfavorite") : t("app.pages.watchlist.favorite")}
                          className={`rounded p-0.5 ${w.favorite ? "text-amber-400" : "text-muted-foreground"}`}
                        >
                          <Star className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeItem(w.id); }}
                          title={t("app.pages.watchlist.remove")}
                          className="rounded p-0.5 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: matching events */}
        <div className="glass-card p-4">
          {!activeWatch ? (
            <EmptyState
              title={t("app.pages.watchlist.selectTitle")}
              hint={t("app.pages.watchlist.selectHint")}
            />
          ) : (
            <>
              <SectionHeader
                title={`${activeWatch.label}`}
                subtitle={t("app.pages.watchlist.matchingSubtitle", {
                  count: matchingEvents.length,
                  type: t(TYPE_CONFIG[activeWatch.type].labelKey),
                })}
                right={
                  <div className="flex items-center gap-2">
                    <DataBadge variant={matchingEvents.length > 0 ? "live" : "neutral"}>
                      {t("app.pages.watchlist.eventsCount", { count: matchingEvents.length })}
                    </DataBadge>
                    {activeWatch.type === "country" && (
                      <Link
                        to="/country/$name"
                        params={{ name: encodeURIComponent(activeWatch.value) }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {t("app.pages.watchlist.countryIntel")}
                      </Link>
                    )}
                  </div>
                }
              />

              {loading && !intel.length ? (
                <LoadingSpinner label={t("app.pages.watchlist.loadingEvents")} />
              ) : matchingEvents.length === 0 ? (
                <EmptyState
                  title={t("app.pages.watchlist.noMatchTitle", { label: activeWatch.label })}
                  hint={t("app.pages.watchlist.noMatchHint")}
                />
              ) : (
                <div className="mt-4 space-y-2">
                  {matchingEvents.map((event) => (
                    <WatchEventRow
                      key={event.id}
                      event={event}
                      onOpenDetail={setActiveModal}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Suggested watches */}
      {watchlist.length === 0 && (
        <div className="glass-card p-4">
          <SectionHeader title={t("app.pages.watchlist.suggestedTitle")} subtitle={t("app.pages.watchlist.suggestedSubtitle")} />
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { type: "country" as WatchType, value: "Ukraine" },
              { type: "country" as WatchType, value: "Russia" },
              { type: "country" as WatchType, value: "China" },
              { type: "category" as WatchType, value: "military" },
              { type: "category" as WatchType, value: "cyber" },
              { type: "severity" as WatchType, value: "critical" },
              { type: "keyword" as WatchType, value: "nuclear" },
              { type: "keyword" as WatchType, value: "sanctions" },
            ].map((s) => (
              <button
                key={`${s.type}-${s.value}`}
                type="button"
                onClick={() => {
                  const cfg = TYPE_CONFIG[s.type];
                  const item: WatchlistItem = {
                    id: `${s.type}-${Date.now()}-${s.value}`,
                    type: s.type,
                    value: s.value,
                    label: s.value,
                    pinned: false,
                    favorite: false,
                    addedAt: new Date().toISOString(),
                  };
                  setWatchlist((prev) => [...prev, item]);
                  setSelected(item.id);
                  toast.success(t("app.toasts.watchAdded", { value: s.value }));
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                {(() => { const Icon = TYPE_CONFIG[s.type].icon; return <Icon className="h-3 w-3" />; })()}
                {s.value}
              </button>
            ))}
          </div>
        </div>
      )}

      <IntelligenceDetailsModal item={activeModal} onClose={() => setActiveModal(null)} onSave={onSaveItem} />
    </div>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function WatchEventRow({
  event,
  onOpenDetail,
}: {
  event: IntelligenceItem;
  onOpenDetail: (item: IntelligenceItem) => void;
}) {
  const t = useT();
  const ageMs = Date.now() - new Date(event.publishedAt).getTime();
  const ageLabel = ageMs < 3_600_000
    ? `${Math.round(ageMs / 60_000)}m`
    : ageMs < 86_400_000
    ? `${Math.round(ageMs / 3_600_000)}h`
    : `${Math.round(ageMs / 86_400_000)}d`;

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-secondary/10 p-3 transition-colors hover:border-border/70">
      <SeverityBadge severity={event.severity} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpenDetail(event)} className="block text-left">
          <div className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
            {event.title}
          </div>
        </button>
        {event.description && (
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{event.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>{event.source}</span>
          <span>·</span>
          <span className="capitalize">{event.category}</span>
          {event.country && <><span>·</span><span>{event.country}</span></>}
          <span>·</span>
          <span>{ageLabel} ago</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenDetail(event)}
          title={t("app.pages.watchlist.openDetails")}
          className="rounded border border-border/50 p-1.5 text-muted-foreground hover:text-primary"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {sanitizeUrl(event.url) && (
          <a
            href={sanitizeUrl(event.url)}
            target="_blank"
            rel="noreferrer"
            title={t("app.pages.watchlist.originalSource")}
            className="rounded border border-border/50 p-1.5 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Link
          to="/event/$id"
          params={{ id: encodeURIComponent(event.id) }}
          title={t("app.pages.watchlist.fullAnalysis")}
          className="rounded border border-primary/40 bg-primary/10 px-2 py-1.5 text-[10px] text-primary hover:bg-primary/20"
        >
          {t("app.pages.watchlist.analyze")}
        </Link>
      </div>
    </div>
  );
}
