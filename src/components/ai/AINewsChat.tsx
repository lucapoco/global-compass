import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, Loader2, Bookmark, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  type AINewsContext,
  type AINewsMessage,
  SUGGESTED_PROMPTS,
  WELCOME_MESSAGE,
  buildNewsContext,
  createMessage,
  sendGlobalPulseAIChat,
} from "@/services/aiNewsAnalystService";
import { isSupabaseConfigured, supabaseService } from "@/services/supabaseService";
import { AINewsMessageBubble } from "./AINewsMessageBubble";
import { SuggestedPromptButton } from "./SuggestedPromptButton";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useAuth } from "@/auth";

interface Props {
  context: AINewsContext | null;
  onContextRefresh: () => Promise<void>;
  contextLoading?: boolean;
  pendingPrompt?: { text: string; id: number } | null;
}

export function AINewsChat({ context, onContextRefresh, contextLoading, pendingPrompt }: Props) {
  const t = useT();
  const { requireAuth } = useAuth();
  const [messages, setMessages] = useState<AINewsMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lastPair, setLastPair] = useState<{ question: string; answer: string } | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef(context);
  const welcomedRef = useRef(false);
  ctxRef.current = context;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    setMessages([createMessage("assistant", WELCOME_MESSAGE)]);
  }, []);

  const sendQuestion = useCallback(
    async (question: string, isRetry = false) => {
      const q = question.trim();
      if (!q || thinking) return;

      let ctx = ctxRef.current;
      if (!ctx) {
        try {
          ctx = await buildNewsContext();
          await onContextRefresh();
        } catch {
          toast.error(t("app.pages.aiNews.toastContextFailed"));
          return;
        }
      }

      if (!isRetry) {
        setMessages((prev) => [...prev, createMessage("user", q)]);
      }
      setInput("");
      setThinking(true);
      setLastFailedQuestion(null);

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => !(m.role === "assistant" && m.content === WELCOME_MESSAGE))
        .slice(-12)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      try {
        const result = await sendGlobalPulseAIChat(history, q, ctx);
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", result.answer, {
            aiStatus: result.status,
            localFallback: result.localFallback,
            geminiLive: result.geminiLive,
            model: result.model,
            retryCount: result.retryCount,
          }),
        ]);
        setLastPair({ question: q, answer: result.answer });
        if (result.status === "LOCAL FALLBACK") {
          toast.message(t("app.pages.aiNews.toastLocalFallback"));
        } else if (result.status === "GEMINI FALLBACK MODEL") {
          toast.message(t("app.pages.aiNews.toastFallbackModel"));
        } else if (result.status === "GEMINI ERROR") {
          toast.error(result.errorMessage ?? t("app.pages.aiNews.toastGeminiError"));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t("app.pages.aiNews.toastAiFailed");
        toast.error(msg);
        setLastFailedQuestion(q);
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", t("app.pages.aiNews.processError", { message: msg }), {
            localFallback: true,
            aiStatus: "GEMINI ERROR",
          }),
        ]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, messages, onContextRefresh, t],
  );

  useEffect(() => {
    if (pendingPrompt?.text) {
      void sendQuestion(pendingPrompt.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt?.id]);

  function saveBriefing() {
    if (!lastPair) {
      toast.message(t("app.pages.aiNews.toastAskFirst"));
      return;
    }
    requireAuth(() => {
      void (async () => {
        if (!isSupabaseConfigured()) {
          toast.error(t("app.ui.notConfigured"));
          return;
        }
        try {
          await supabaseService.saveAIBriefing({
            question: lastPair.question,
            answer: lastPair.answer,
            data_status: context?.dataStatus.news ?? "UNKNOWN",
          });
          toast.success(t("app.pages.aiNews.toastBriefingSaved"));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : t("app.ui.saveFailed");
          if (/ai_briefings|does not exist|relation/i.test(msg)) {
            toast.error(t("app.pages.aiNews.toastBriefingTableMissing"));
          } else {
            toast.error(msg);
          }
        }
      })();
    }, "save_article");
  }

  function clearChat() {
    setMessages([createMessage("assistant", WELCOME_MESSAGE)]);
    setLastPair(null);
    setLastFailedQuestion(null);
  }

  return (
    <div className="glass-card flex min-h-[480px] flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
          <p className="text-xs text-muted-foreground">{t("app.pages.aiNews.chatSubtitle")}</p>
          <div className="flex flex-wrap gap-2">
            {lastFailedQuestion ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void sendQuestion(lastFailedQuestion, true)}
                disabled={thinking}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t("app.ui.retry")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => void saveBriefing()}
              disabled={!lastPair}
              title={!lastPair ? t("app.pages.aiNews.askFirstTitle") : t("app.pages.aiNews.saveTitle")}
            >
              <Bookmark className="mr-1 h-3.5 w-3.5" /> {t("app.pages.aiNews.saveBriefing")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearChat}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("app.pages.aiNews.clearChat")}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUGGESTED_PROMPTS.map((p) => (
            <SuggestedPromptButton
              key={p}
              label={p}
              onClick={() => void sendQuestion(p)}
              disabled={thinking || contextLoading}
            />
          ))}
        </div>

        <div className="panel-scroll min-h-[240px] max-h-[50vh] flex-1 space-y-4 pr-1 lg:max-h-[calc(100vh-22rem)]">
          {messages.map((m) => (
            <AINewsMessageBubble key={m.id} message={m} />
          ))}
          {thinking ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("app.pages.aiNews.thinking")}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        className="sticky bottom-0 border-t border-border/40 bg-card/80 p-3 backdrop-blur-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void sendQuestion(input);
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("app.pages.aiNews.placeholder")}
            disabled={thinking}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-45"
          />
          <Button type="submit" disabled={thinking || !input.trim()} className="h-9 shrink-0">
            <Send className="h-4 w-4" />
            <span className="sr-only">{t("app.ui.send")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
