import { createFileRoute } from "@tanstack/react-router";
import { callGeminiChat, GeminiChatError } from "@/lib/geminiChatServer";
import { getGeminiConfig } from "@/server/geminiConfig";
import { checkRateLimit } from "@/server/rateLimiter";
import { toAiClientError } from "@/lib/userErrorMessage";
import { validateAiChatBody } from "@/server/aiRequestGuard";
import type {
  AIChatErrorResponse,
  AIChatRequestBody,
  AIChatSuccessResponse,
  AIProviderStatusResponse,
} from "@/lib/aiChatTypes";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: unknown, status = 200, retryAfterSec?: number) {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return new Response(JSON.stringify(body), { status, headers });
}

function providerStatus(): AIProviderStatusResponse {
  const { configured, model, fallbackModel } = getGeminiConfig();
  return {
    configured,
    provider: "Google Gemini",
    model,
    fallbackModel,
    status: configured ? "GEMINI LIVE" : "GEMINI NOT CONFIGURED",
  };
}

export const Route = createFileRoute("/api/ai-news-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: JSON_HEADERS }),
      GET: async () => json(providerStatus()),
      POST: async ({ request }) => {
        // Public, unauthenticated endpoint — cap per-IP usage so the shared
        // GEMINI_API_KEY quota can't be exhausted by a single caller.
        const rate = checkRateLimit(request, "ai-news-chat", 20, 60_000);
        if (!rate.allowed) {
          return json(
            { error: "Too many requests — please slow down.", errorCode: "RATE_LIMIT", configured: true },
            429,
            rate.retryAfterSec,
          );
        }

        const { configured } = getGeminiConfig();
        if (!configured) {
          const err: AIChatErrorResponse = {
            error: toAiClientError("MISSING_API_KEY"),
            errorCode: "MISSING_API_KEY",
            configured: false,
            status: "GEMINI NOT CONFIGURED",
          };
          return json(err, 503);
        }

        const validated = await validateAiChatBody(request);
        if (!validated.ok) {
          return json({ error: validated.error, configured: true }, validated.status);
        }
        const body = validated.body;

        try {
          const result: AIChatSuccessResponse = await callGeminiChat(body);
          return json(result);
        } catch (e: unknown) {
          if (e instanceof GeminiChatError) {
            const httpStatus =
              e.code === "MISSING_API_KEY"
                ? 503
                : e.code === "INVALID_API_KEY"
                  ? 401
                  : e.code === "BAD_REQUEST"
                    ? 400
                    : e.code === "RATE_LIMIT"
                      ? 429
                      : e.code === "HIGH_DEMAND"
                        ? 503
                        : 502;
            const safeMessage = toAiClientError(e.code);
            const err: AIChatErrorResponse = {
              error: safeMessage,
              errorMessage: safeMessage,
              errorCode: e.code,
              status:
                e.code === "HIGH_DEMAND" || e.code === "RATE_LIMIT"
                  ? "GEMINI TEMPORARILY BUSY"
                  : "GEMINI ERROR",
              retryCount: e.retryCount,
              configured: e.code !== "MISSING_API_KEY",
            };
            console.error("[ai-news-chat] Gemini error:", e.code, e.message);
            return json(err, httpStatus);
          }
          console.error("[ai-news-chat] unexpected error:", e);
          const err: AIChatErrorResponse = {
            error: toAiClientError(),
            errorCode: "UNKNOWN",
            configured: true,
          };
          return json(err, 502);
        }
      },
    },
  },
});
