/**
 * Global Pulse AI — Intelligence Command Center
 *
 * Transforms the AI chat page into a professional intelligence workspace:
 *  • Command-center header with live Gemini status and context summary
 *  • Horizontal suggested-prompt strip (context-aware quick questions)
 *  • Left panel with knowledge sources and quick actions (XL+)
 *  • Center: AINewsChat (conversation area)
 *  • Right: AINewsContextPanel (live data panel)
 *  • Accepts a pendingPrompt from the router outlet context (command palette)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Brain, Zap, Shield, Globe2, Activity, CloudSun,
  BookOpen, RefreshCw, FileText, Map, BarChart2,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DataBadge } from "@/components/ui/DataBadge";
import { PageHero } from "@/components/ui/PageHero";
import { Button } from "@/components/ui/button";
import { AINewsChat } from "@/components/ai/AINewsChat";
import { AINewsContextPanel } from "@/components/ai/AINewsContextPanel";
import {
  buildNewsContext,
  fetchGeminiProviderStatus,
  type AINewsContext,
} from "@/services/aiNewsAnalystService";
import type { GeminiProviderStatus } from "@/lib/aiChatTypes";
import type { NewsStatus } from "@/services/newsApi";
import { useT } from "@/i18n";

export const Route = createFileRoute("/ai-news")({
  head: () => ({
    meta: [
      { title: "Global Pulse AI — Intelligence Assistant" },
      {
        name: "description",
        content:
          "Intelligence Command Center — ask Global Pulse AI about breaking news, country risk, earthquakes, and global events.",
      },
    ],
  }),
  component: AINewsPage,
});

/* ── Context-aware suggested prompts ─────────────────────────────────────── */

interface PromptPill {
  id: string;
  labelKey: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const BASE_PROMPTS: Omit<PromptPill, "label">[] = [
  { id: "situation", labelKey: "app.pages.aiNews.promptSituation", icon: Globe2,    color: "text-cyan-400" },
  { id: "risks",     labelKey: "app.pages.aiNews.promptRisks",     icon: Shield,    color: "text-rose-400" },
  { id: "briefing",  labelKey: "app.pages.aiNews.promptBriefing",  icon: Brain,     color: "text-violet-400" },
  { id: "quakes",    labelKey: "app.pages.aiNews.promptQuakes",    icon: Activity,  color: "text-amber-400" },
  { id: "regions",   labelKey: "app.pages.aiNews.promptRegions",   icon: Map,       color: "text-orange-400" },
  { id: "cyber",     labelKey: "app.pages.aiNews.promptCyber",     icon: Zap,       color: "text-yellow-400" },
  { id: "weather",   labelKey: "app.pages.aiNews.promptWeather",   icon: CloudSun,  color: "text-sky-400" },
];

const BREAKING_PROMPT: Omit<PromptPill, "label"> = {
  id: "breaking", labelKey: "app.pages.aiNews.promptBreaking", icon: Sparkles, color: "text-primary",
};

function buildSuggestedPrompts(
  ctx: AINewsContext | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): PromptPill[] {
  const items = [...BASE_PROMPTS];
  if (ctx && (ctx.intelligenceItems?.length ?? 0) > 0) {
    items.unshift(BREAKING_PROMPT);
  }
  return items.map((p) => ({ ...p, label: t(p.labelKey) }));
}

/* ── Left intelligence panel (XL only) ──────────────────────────────────── */

interface LeftPanelProps {
  ctx: AINewsContext | null;
  onPrompt: (text: string) => void;
}

function AILeftPanel({ ctx, onPrompt }: LeftPanelProps) {
  const t = useT();

  const dataSources = [
    { labelKey: "app.pages.aiNews.sourceLiveNews",      count: ctx?.intelligenceItems?.length ?? 0, icon: Sparkles, active: (ctx?.intelligenceItems?.length ?? 0) > 0,  color: "text-primary" },
    { labelKey: "app.pages.aiNews.sourceEarthquakes",   count: ctx?.earthquakes?.length ?? 0,        icon: Activity, active: (ctx?.earthquakes?.length ?? 0) > 0,         color: "text-amber-400" },
    { labelKey: "app.pages.aiNews.sourceCountryRisk",   count: ctx?.countryRisks?.length ?? 0,       icon: Shield,   active: (ctx?.countryRisks?.length ?? 0) > 0,        color: "text-rose-400" },
    { labelKey: "app.pages.aiNews.sourceSaved",         count: ctx?.intelligenceItems?.length ?? 0,  icon: BookOpen, active: false,                                        color: "text-muted-foreground" },
  ];

  const quickActions = [
    { labelKey: "app.pages.aiNews.navReport",   icon: FileText,  to: "/reports" },
    { labelKey: "app.pages.aiNews.navMap",      icon: Map,       to: "/map" },
    { labelKey: "app.pages.aiNews.navAnalytics",icon: BarChart2, to: "/analytics" },
    { labelKey: "app.pages.aiNews.navFeed",     icon: Globe2,    to: "/intelligence" },
  ];

  const prompts = buildSuggestedPrompts(ctx, t);

  return (
    <aside className="hidden xl:flex flex-col gap-4" aria-label={t("app.pages.aiNews.ariaSidebar")}>
      {/* Knowledge sources */}
      <div className="glass-card p-4">
        <div className="text-label text-muted-foreground mb-3">{t("app.pages.aiNews.knowledgeSources")}</div>
        <div className="space-y-2">
          {dataSources.map((s) => {
            const Icon = s.icon;
            const label = t(s.labelKey);
            return (
              <div key={s.labelKey} className="flex items-center gap-2.5">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${s.active ? "border-border/40 bg-secondary/20" : "border-border/20 bg-secondary/10"}`}>
                  <Icon className={`h-3 w-3 ${s.active ? s.color : "text-muted-foreground/30"}`} aria-hidden="true" />
                </div>
                <span className={`flex-1 text-xs ${s.active ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {label}
                </span>
                <span className={`text-[10px] tabular-nums font-medium ${s.active ? s.color : "text-muted-foreground/40"}`}>
                  {s.count > 0 ? s.count : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick prompts */}
      <div className="glass-card p-4">
        <div className="text-label text-muted-foreground mb-3">{t("app.pages.aiNews.quickAnalysis")}</div>
        <div className="space-y-1.5">
          {prompts.slice(0, 5).map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPrompt(p.label)}
                className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-secondary/10 px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                aria-label={t("app.pages.aiNews.askAria", { label: p.label })}
              >
                <Icon className={`h-3 w-3 shrink-0 ${p.color}`} aria-hidden="true" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick navigation */}
      <div className="glass-card p-4">
        <div className="text-label text-muted-foreground mb-3">{t("app.pages.aiNews.quickNav")}</div>
        <div className="space-y-1">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t(a.labelKey)}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* ── Gemini status display ───────────────────────────────────────────────── */

function GeminiStatusChip({ status }: { status: GeminiProviderStatus }) {
  const t = useT();
  const isOnline = status === "GEMINI LIVE" || status === "GEMINI FALLBACK MODEL";
  const Icon = isOnline ? CheckCircle2 : AlertCircle;
  const color = isOnline ? "text-emerald-400" : "text-amber-400";
  const label = status === "GEMINI LIVE" ? t("app.pages.aiNews.geminiLive")
    : status === "GEMINI FALLBACK MODEL" ? t("app.pages.aiNews.geminiFallback")
    : status === "GEMINI NOT CONFIGURED" ? t("app.pages.aiNews.localFallback")
    : "Limited";

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/50 px-2.5 py-1.5 ${color}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

function AINewsPage() {
  const t = useT();
  const [context, setContext] = useState<AINewsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [geminiStatus, setGeminiStatus] = useState<GeminiProviderStatus>("GEMINI NOT CONFIGURED");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-lite");
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; id: number } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const loadingRef = useRef(false);

  const loadContext = useCallback(async (force = false) => {
    if (loadingRef.current && !force) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const ctx = await buildNewsContext({ force });
      setContext(ctx);
      setLastRefresh(new Date());
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => { void loadContext(false); }, [loadContext]);

  useEffect(() => {
    void fetchGeminiProviderStatus().then((s) => {
      setGeminiStatus(s.status);
      setGeminiModel(s.model);
    });
  }, []);

  // Listen for AI prompts broadcast by the command palette
  useEffect(() => {
    function onAIPrompt(e: Event) {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text) handlePrompt(detail.text);
    }
    window.addEventListener("global-pulse:ai-prompt", onAIPrompt);
    return () => window.removeEventListener("global-pulse:ai-prompt", onAIPrompt);
  }, []);

  function handlePrompt(text: string) {
    setPendingPrompt((prev) => ({ text, id: (prev?.id ?? 0) + 1 }));
  }

  const status = context?.newsStatus ?? "demo";
  const eventCount = context?.intelligenceItems?.length ?? 0;
  const isConnected = status === "live" || status === "cached";

  const prompts = buildSuggestedPrompts(context, t);

  return (
    <div className="page-shell space-y-4" role="main" aria-label={t("app.pages.aiNews.ariaMain")}>

      <PageHero
        title={t("app.pages.aiNews.title")}
        subtitle={t("app.pages.aiNews.subtitle", { model: geminiModel, count: eventCount })}
        icon={<Brain className="h-5 w-5" />}
        badges={
          <>
            <GeminiStatusChip status={geminiStatus} />
            <DataBadge variant={isConnected ? "live" : "neutral"}>{status.toUpperCase()}</DataBadge>
            {eventCount > 0 && <DataBadge variant="neutral">{t("app.pages.aiNews.eventsBadge", { count: eventCount })}</DataBadge>}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadContext(true)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("app.pages.aiNews.refreshContext")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
          {loading
            ? t("app.pages.aiNews.loadingContext")
            : t("app.pages.aiNews.contextReady", { count: eventCount })}
        </div>
        <div suppressHydrationWarning className="flex items-center gap-1 ml-auto">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SUGGESTED PROMPT PILLS
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="group"
        aria-label={t("app.pages.aiNews.ariaPrompts")}
      >
        {prompts.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePrompt(p.label)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-secondary/15 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/8 hover:text-foreground"
              aria-label={t("app.pages.aiNews.askAria", { label: p.label })}
            >
              <Icon className={`h-3 w-3 shrink-0 ${p.color}`} aria-hidden="true" />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN WORKSPACE GRID
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 xl:grid-cols-[220px_1fr_300px] lg:grid-cols-[1fr_300px]">

        {/* Left panel — XL only */}
        <AILeftPanel ctx={context} onPrompt={handlePrompt} />

        {/* Center — Conversation */}
        <AINewsChat
          context={context}
          contextLoading={loading}
          onContextRefresh={async () => { await loadContext(false); }}
          pendingPrompt={pendingPrompt}
        />

        {/* Right — Context Panel */}
        <AINewsContextPanel
          context={context}
          loading={loading}
          geminiStatus={geminiStatus}
          geminiModel={geminiModel}
          onRefresh={() => void loadContext(false)}
        />
      </div>
    </div>
  );
}
