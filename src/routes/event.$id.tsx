/**
 * Event Detail Page — GP-010: Unified Event Details.
 *
 * Route: /event/$id
 *
 * Architecture decision:
 *  Every GlobalEvent is accessible via a permanent URL.
 *  The page fetches fresh intelligence data (cached 30 min in newsApi),
 *  finds the event by ID, and renders a complete intelligence object:
 *  • Full context and metadata
 *  • Severity / Importance / Confidence scores
 *  • Source + links to original articles
 *  • Coordinates (with map link)
 *  • Related events (same country or category)
 *  • AI analysis via /api/ai-news-chat
 *  • Recommended actions per category/severity
 *
 *  If the event is not found (expired from cache), a graceful
 *  "Event not found" page is shown with navigation options.
 */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ExternalLink, MapPin, Calendar, Globe2, Shield,
  Brain, Bookmark, Activity, Share2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DataBadge } from "@/components/ui/DataBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/button";
// Centralized Intelligence Store — an event permalink now resolves against
// every active provider (GNews, USGS, GDACS, ReliefWeb, GDELT, RSS, ACLED,
// NASA FIRMS, World Bank, ...), not just GNews.
import { getLatestEvents } from "@/domain/store";
import { toIntelligenceItems } from "@/domain/adapters/legacyIntelAdapter";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { sanitizeUrl } from "@/lib/utils";
import type { IntelligenceItem } from "@/types";
import { useT } from "@/i18n";
import { useAuth } from "@/auth";
import { saveArticle, trackReading } from "@/services/personalizationService";
import en from "@/locales/en.json";

export const Route = createFileRoute("/event/$id")({
  head: () => ({ meta: [{ title: en.app.pages.eventDetail.metaTitle }] }),
  component: EventDetailPage,
});

// ─── Recommended actions by category ─────────────────────────────────────────

function getRecommendedActions(
  category: string,
  severity: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  const actions: string[] = [];
  for (let i = 0; i < 3; i++) {
    const key = `app.pages.eventDetail.actions.${category}_${i}`;
    const translated = t(key);
    actions.push(
      translated !== key
        ? translated
        : t(`app.pages.eventDetail.actions.general_${i}`),
    );
  }
  if (severity === "critical" || severity === "high") {
    return [t("app.pages.eventDetail.prioritize"), ...actions];
  }
  return actions;
}

function timeAgo(
  ts: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return t("app.ui.time.justNow");
  if (ms < 3_600_000) return t("app.ui.time.minutesAgo", { count: Math.round(ms / 60_000) });
  if (ms < 86_400_000) return t("app.ui.time.hoursAgo", { count: Math.round(ms / 3_600_000) });
  return t("app.ui.time.daysAgo", { count: Math.round(ms / 86_400_000) });
}

// ─── Related events helper ────────────────────────────────────────────────────

function findRelated(current: IntelligenceItem, all: IntelligenceItem[]): IntelligenceItem[] {
  return all
    .filter((i) => i.id !== current.id)
    .filter(
      (i) =>
        (i.country && i.country === current.country) ||
        i.category === current.category,
    )
    .sort((a, b) => {
      const countryMatch = (a.country === current.country ? 1 : 0) - (b.country === current.country ? 1 : 0);
      if (countryMatch !== 0) return -countryMatch;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, 6);
}

// ─── Page component ───────────────────────────────────────────────────────────

function EventDetailPage() {
  const t = useT();
  const { requireAuth, isAuthenticated } = useAuth();
  const { id: rawId } = Route.useParams();
  const router = useRouter();
  const id = decodeURIComponent(rawId);

  const [allEvents, setAllEvents] = useState<IntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    document.title = t("app.pages.eventDetail.metaTitle");
  }, [t]);

  // Load all intelligence events from the shared store (fast on repeat visits)
  useEffect(() => {
    getLatestEvents({ limit: 300 })
      .then((events) => setAllEvents(toIntelligenceItems(events)))
      .catch(() => setAllEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const event = useMemo(() => allEvents.find((e) => e.id === id), [allEvents, id]);
  const related = useMemo(
    () => (event ? findRelated(event, allEvents) : []),
    [event, allEvents],
  );

  // Track reading history for signed-in users (silent failure if table missing)
  useEffect(() => {
    if (!event || !isAuthenticated) return;
    void trackReading({
      article_id: event.id,
      title: event.title,
      summary: event.description,
      source: event.source,
      url: event.url,
      category: event.category,
      country: event.country,
    }).catch(() => { /* ignore */ });
  }, [event, isAuthenticated]);

  const actions = useMemo(
    () => (event ? getRecommendedActions(event.category ?? "general", event.severity, t) : []),
    [event, t],
  );

  const handleSave = useCallback(() => {
    if (!event) return;
    requireAuth(() => {
      void (async () => {
        if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
        try {
          await saveArticle({
            article_id: event.id,
            title: event.title,
            summary: event.description,
            category: event.category,
            severity: event.severity,
            country: event.country,
            source: event.source,
            url: event.url,
            image_url: event.imageUrl,
            published_at: event.publishedAt,
          });
          try { await supabaseService.saveIntelligence(event); } catch { /* optional */ }
          toast.success(t("app.toasts.eventSavedSupabase"));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("app.ui.saveFailed"));
        }
      })();
    }, "save_article");
  }, [event, t, requireAuth]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success(t("app.toasts.linkCopied"));
    });
  }, [t]);

  const handleAI = useCallback(async () => {
    if (!event) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const prompt = `Provide a professional intelligence analysis of: "${event.title}".
Country: ${event.country ?? "Unknown"}. Category: ${event.category}. Severity: ${event.severity}.

Include:
1. Brief factual summary (2-3 sentences)
2. Geopolitical significance
3. Potential short-term consequences
4. Key actors involved (if discernible from title)

Be concise, factual, and analytical. Avoid speculation.`;

      const res = await fetch("/api/ai-news-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: {
            dataStatus: { news: "live", earthquakes: "live", supabase: "na", overall: "live" },
            newsSource: event.source,
            lastUpdated: event.publishedAt,
            intelligenceItems: [],
            criticalAlerts: [],
            earthquakes: [],
            countryRisks: [],
            savedDataSummary: { intelligenceCount: 0, alertsCount: 0, countriesCount: 0 },
            apiHealth: { gnews: "live", usgs: "live", supabase: "na", openWeather: "na", map: "na" },
          },
        }),
      });
      const data = (await res.json()) as { answer?: string; fallbackAnswer?: string };
      setAiSummary(data.answer ?? data.fallbackAnswer ?? t("app.pages.eventDetail.noAnalysis"));
    } catch {
      toast.error(t("app.toasts.aiAnalysisFailed"));
    } finally {
      setAiLoading(false);
    }
  }, [event, t]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner label={t("app.pages.eventDetail.loading")} />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!event) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("app.pages.eventDetail.back")}
        </button>
        <EmptyState
          title={t("app.pages.eventDetail.notFoundTitle")}
          hint={t("app.pages.eventDetail.notFoundHint")}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link to="/intelligence">{t("app.pages.eventDetail.browseFeed")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">{t("app.pages.eventDetail.returnDashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const publishedDate = new Date(event.publishedAt);
  const ageLabel = timeAgo(publishedDate.getTime(), t);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("app.pages.eventDetail.back")}
      </button>

      {/* ── Hero: Title + Severity ──────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden p-5">
        {/* Image banner */}
        {event.imageUrl && (
          <div className="mb-4 -mx-5 -mt-5">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-48 w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <SeverityBadge severity={event.severity} />
          <DataBadge variant="neutral">{event.category}</DataBadge>
          {event.isLive && <DataBadge variant="live">{t("app.pages.eventDetail.live")}</DataBadge>}
          <DataBadge variant="source">{event.source}</DataBadge>
        </div>

        <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight md:text-2xl">
          {event.title}
        </h1>

        {event.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {event.country && (
            <span className="flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5" />
              <Link to="/country/$name" params={{ name: encodeURIComponent(event.country) }} className="hover:text-primary hover:underline">
                {event.country}
              </Link>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span suppressHydrationWarning>{publishedDate.toLocaleString()}</span> · {ageLabel}
          </span>
          {event.latitude != null && event.longitude != null && (
            <a
              href={`https://maps.google.com/?q=${event.latitude},${event.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-primary"
            >
              <MapPin className="h-3.5 w-3.5" />
              {event.latitude.toFixed(3)}, {event.longitude.toFixed(3)}
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {sanitizeUrl(event.url) && (
            <a
              href={sanitizeUrl(event.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("app.pages.eventDetail.sourceArticle")}
            </a>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
          >
            <Bookmark className="h-3.5 w-3.5" /> {t("app.pages.eventDetail.saveEvent")}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
          >
            <Share2 className="h-3.5 w-3.5" /> {t("app.pages.eventDetail.shareLink")}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Left column: AI + Actions ──────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* AI Analysis */}
          <div className="glass-card p-4">
            <SectionHeader
              title={t("app.pages.eventDetail.aiTitle")}
              subtitle={t("app.pages.eventDetail.aiSubtitle")}
              right={<Brain className="h-4 w-4 text-primary" />}
            />
            {!aiSummary && !aiLoading && (
              <button
                type="button"
                onClick={handleAI}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
              >
                <Brain className="h-4 w-4" /> {t("app.pages.eventDetail.generateBriefing")}
              </button>
            )}
            {aiLoading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4 animate-spin" /> {t("app.pages.eventDetail.analyzing")}
              </div>
            )}
            {aiSummary && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
                {aiSummary}
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          <div className="glass-card p-4">
            <SectionHeader
              title={t("app.pages.eventDetail.actionsTitle")}
              subtitle={t("app.pages.eventDetail.actionsSubtitle")}
              right={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            />
            <ul className="mt-3 space-y-2">
              {actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* Related Events */}
          {related.length > 0 && (
            <div className="glass-card p-4">
              <SectionHeader
                title={t("app.pages.eventDetail.relatedTitle")}
                subtitle={t("app.pages.eventDetail.relatedSubtitle")}
              />
              <div className="mt-3 space-y-2">
                {related.map((rel) => (
                  <Link
                    key={rel.id}
                    to="/event/$id"
                    params={{ id: encodeURIComponent(rel.id) }}
                    className="flex items-start gap-2 rounded-lg border border-border/40 p-2.5 transition-colors hover:border-primary/40"
                  >
                    <SeverityBadge severity={rel.severity} />
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-xs font-medium">{rel.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {rel.source} · {rel.country ?? rel.category}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar: metadata ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Intelligence metadata */}
          <div className="glass-card p-4">
            <SectionHeader
              title={t("app.pages.eventDetail.metaTitleSection")}
              subtitle={t("app.pages.eventDetail.metaSubtitle")}
            />
            <div className="mt-3 space-y-2">
              <MetaRow label={t("app.pages.eventDetail.metaId")} value={event.id.slice(0, 24) + "…"} />
              <MetaRow label={t("app.pages.eventDetail.metaSource")} value={event.source} />
              <MetaRow label={t("app.pages.eventDetail.metaCategory")} value={event.category} />
              <MetaRow label={t("app.pages.eventDetail.metaSeverity")} value={event.severity} />
              <MetaRow label={t("app.pages.eventDetail.metaCountry")} value={event.country ?? "—"} />
              <MetaRow
                label={t("app.pages.eventDetail.metaLive")}
                value={event.isLive ? t("app.pages.eventDetail.metaYes") : t("app.pages.eventDetail.metaNo")}
              />
              {event.latitude != null && (
                <MetaRow
                  label={t("app.pages.eventDetail.metaCoordinates")}
                  value={`${event.latitude.toFixed(2)}, ${event.longitude?.toFixed(2)}`}
                />
              )}
              <MetaRow label={t("app.pages.eventDetail.metaPublished")} value={publishedDate.toISOString().slice(0, 10)} />
            </div>
          </div>

          {/* Country quick link */}
          {event.country && (
            <div className="glass-card p-4">
              <SectionHeader title={t("app.pages.eventDetail.countryIntelTitle")} />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("app.pages.eventDetail.countryIntelHint", { country: event.country })}
              </p>
              <Link
                to="/country/$name"
                params={{ name: encodeURIComponent(event.country) }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
              >
                <Shield className="h-3.5 w-3.5" /> {t("app.pages.eventDetail.countryIntelLink", { country: event.country })}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
