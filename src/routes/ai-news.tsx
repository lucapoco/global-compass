import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { AINewsChat } from "@/components/ai/AINewsChat";
import { AINewsContextPanel } from "@/components/ai/AINewsContextPanel";
import {
  buildNewsContext,
  fetchGeminiProviderStatus,
  type AINewsContext,
} from "@/services/aiNewsAnalystService";
import type { GeminiProviderStatus } from "@/lib/aiChatTypes";
import type { NewsStatus } from "@/services/newsApi";

export const Route = createFileRoute("/ai-news")({
  head: () => ({
    meta: [
      { title: "Global Pulse AI — Global Pulse" },
      {
        name: "description",
        content:
          "Ask Global Pulse AI about breaking news, the world map, country risk, and how the platform works — powered by in-app data and Google Gemini on the server.",
      },
    ],
  }),
  component: AINewsPage,
});

function pageStatusLabel(status: NewsStatus): string {
  switch (status) {
    case "live":
      return "LIVE DATA";
    case "cached":
      return "CACHED DATA";
    case "demo":
      return "DEMO DATA";
    case "rate_limited":
      return "RATE LIMITED";
    case "error":
      return "API ERROR";
    default:
      return "LOADING";
  }
}

function pageStatusVariant(status: NewsStatus): "live" | "neutral" | "demo" | "error" {
  if (status === "live") return "live";
  if (status === "cached") return "neutral";
  if (status === "demo") return "demo";
  return "error";
}

function AINewsPage() {
  const [context, setContext] = useState<AINewsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [geminiStatus, setGeminiStatus] = useState<GeminiProviderStatus>("GEMINI NOT CONFIGURED");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-lite");

  const loadContext = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const ctx = await buildNewsContext({ force });
      setContext(ctx);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext(false);
  }, [loadContext]);

  useEffect(() => {
    void fetchGeminiProviderStatus().then((s) => {
      setGeminiStatus(s.status);
      setGeminiModel(s.model);
    });
  }, []);

  const status = context?.newsStatus ?? "demo";

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <Sparkles className="h-7 w-7 text-primary" />
              Global Pulse AI
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask about headlines, earthquakes, risk scores, the map, and how to use Global Pulse
            </p>
          </div>
          <DataBadge variant={pageStatusVariant(status)}>{pageStatusLabel(status)}</DataBadge>
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
          Answers use data already loaded in the app (GNews proxy, USGS, Supabase bookmarks, country risk). When{" "}
          <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code> is set server-side, responses use Google
          Gemini ({geminiModel}); otherwise a local rule-based fallback applies. The assistant does not invent headlines.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <AINewsChat
          context={context}
          contextLoading={loading}
          onContextRefresh={async () => {
            await loadContext(false);
          }}
        />
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
