/**
 * Maps thrown errors / API failures to user-safe messages.
 * Full details stay in console/server logs — never expose SQL, stack traces,
 * or upstream hostnames in production UI or API responses.
 */
const SENSITIVE =
  /(?:postgres|postgrest|relation|column|syntax error|ECONNREFUSED|fetch failed|401|403|429|api\.|supabase\.co|\.internal)/i;

export function toUserMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (typeof error === "string" && error.trim()) return error;
  }

  if (error instanceof Error) {
    const msg = error.message.trim();
    if (!msg || SENSITIVE.test(msg)) return fallback;
    // Short, generic application errors are OK in production
    if (msg.length <= 120 && !msg.includes("\n")) return msg;
  }

  return fallback;
}

/** Safe client-facing error for Gemini / upstream AI failures. */
export function toAiClientError(code?: string): string {
  switch (code) {
    case "MISSING_API_KEY":
      return import.meta.env.DEV
        ? "AI is not configured — set GEMINI_API_KEY on the server."
        : "AI assistant is temporarily unavailable.";
    case "INVALID_API_KEY":
      return "AI service authentication failed.";
    case "RATE_LIMIT":
    case "HIGH_DEMAND":
      return "AI service is busy — please try again in a moment.";
    case "BAD_REQUEST":
      return "Invalid request — please rephrase and try again.";
    default:
      return "AI service is temporarily unavailable.";
  }
}
