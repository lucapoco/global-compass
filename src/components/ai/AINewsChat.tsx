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

interface Props {
  context: AINewsContext | null;
  onContextRefresh: () => Promise<void>;
  contextLoading?: boolean;
}

export function AINewsChat({ context, onContextRefresh, contextLoading }: Props) {
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
          toast.error("Could not load analyst context.");
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
          toast.message("Using local analyst — Gemini is temporarily busy or unavailable.");
        } else if (result.status === "GEMINI FALLBACK MODEL") {
          toast.message("Primary model busy — answered with fallback Gemini model.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Global Pulse AI failed to respond.";
        toast.error(msg);
        setLastFailedQuestion(q);
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", `I couldn't process that request: ${msg}`, {
            localFallback: true,
            aiStatus: "GEMINI ERROR",
          }),
        ]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, messages, onContextRefresh],
  );

  async function saveBriefing() {
    if (!lastPair) {
      toast.message("Ask a question first to save a briefing.");
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    try {
      await supabaseService.saveAIBriefing({
        question: lastPair.question,
        answer: lastPair.answer,
        data_status: context?.dataStatus.news ?? "UNKNOWN",
      });
      toast.success("Briefing saved");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      if (/ai_briefings|does not exist|relation/i.test(msg)) {
        toast.error("Briefing save table not configured yet.");
      } else {
        toast.error(msg);
      }
    }
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
          <p className="text-xs text-muted-foreground">Global Pulse AI · Google Gemini when configured</p>
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
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => void saveBriefing()}
              disabled={!lastPair}
              title={!lastPair ? "Ask a question first" : "Save last Q&A to Supabase"}
            >
              <Bookmark className="mr-1 h-3.5 w-3.5" /> Save briefing
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearChat}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear chat
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

        <div className="flex-1 space-y-4 overflow-y-auto pr-1 min-h-[240px] max-h-[50vh] lg:max-h-[calc(100vh-22rem)]">
          {messages.map((m) => (
            <AINewsMessageBubble key={m.id} message={m} />
          ))}
          {thinking ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Global Pulse AI is thinking…
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
            placeholder="Ask Global Pulse AI about news, the map, or the platform…"
            disabled={thinking}
            className="flex-1 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
          <Button type="submit" disabled={thinking || !input.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
