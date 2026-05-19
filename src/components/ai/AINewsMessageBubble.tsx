import { Bot, User } from "lucide-react";
import type { AINewsMessage } from "@/services/aiNewsAnalystService";
import type { AIChatStatus } from "@/lib/aiChatTypes";

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={i} className="text-muted-foreground not-italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function statusBadge(status: AIChatStatus) {
  switch (status) {
    case "GEMINI LIVE":
      return (
        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          GEMINI LIVE
        </span>
      );
    case "GEMINI FALLBACK MODEL":
      return (
        <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
          GEMINI FALLBACK MODEL
        </span>
      );
    case "GEMINI TEMPORARILY BUSY":
      return (
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          GEMINI TEMPORARILY BUSY
        </span>
      );
    case "LOCAL FALLBACK":
      return (
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          LOCAL FALLBACK
        </span>
      );
    case "GEMINI ERROR":
      return (
        <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-600/90 dark:text-rose-400/90">
          GEMINI ERROR
        </span>
      );
    default:
      return null;
  }
}

function resolveStatus(message: AINewsMessage): AIChatStatus | undefined {
  if (message.aiStatus) return message.aiStatus;
  if (message.localFallback) return "LOCAL FALLBACK";
  if (message.geminiLive) return "GEMINI LIVE";
  return undefined;
}

interface Props {
  message: AINewsMessage;
}

export function AINewsMessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const status = !isUser ? resolveStatus(message) : undefined;

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isUser ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 bg-secondary/40 text-muted-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "border-primary/30 bg-primary/10 text-foreground"
            : "border-border/50 bg-secondary/20 text-foreground/90"
        }`}
      >
        {status ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {statusBadge(status)}
            {message.model && status !== "LOCAL FALLBACK" ? (
              <span className="text-[10px] text-muted-foreground">{message.model}</span>
            ) : null}
          </div>
        ) : null}
        <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>
        <div className={`mt-1.5 text-[10px] ${isUser ? "text-primary/70" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}