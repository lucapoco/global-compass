import { createFileRoute } from "@tanstack/react-router";
import { callGeminiChat, GeminiChatError } from "@/lib/geminiChatServer";
import { getGeminiConfig } from "@/server/geminiConfig";
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
        const { configured } = getGeminiConfig();
        if (!configured) {
          const err: AIChatErrorResponse = {
            error: "GEMINI_API_KEY is missing on the server",
            errorCode: "MISSING_API_KEY",
            configured: false,
            status: "GEMINI NOT CONFIGURED",
          };
          return json(err, 503);
        }

        let body: AIChatRequestBody;
        try {
          body = (await request.json()) as AIChatRequestBody;
        } catch {
          return json({ error: "Invalid JSON body", configured: true }, 400);
        }

        if (!body?.messages?.length || !body.context) {
          return json({ error: "messages and context are required", configured: true }, 400);
        }

        const last = body.messages[body.messages.length - 1];
        if (!last?.content?.trim() || last.role !== "user") {
          return json({ error: "Last message must be a non-empty user message", configured: true }, 400);
        }

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
            const err: AIChatErrorResponse = {
              error: e.message,
              errorMessage: e.message,
              errorCode: e.code,
              status:
                e.code === "HIGH_DEMAND" || e.code === "RATE_LIMIT"
                  ? "GEMINI TEMPORARILY BUSY"
                  : "GEMINI ERROR",
              retryCount: e.retryCount,
              configured: e.code !== "MISSING_API_KEY",
            };
            return json(err, httpStatus);
          }
          const msg = e instanceof Error ? e.message : "Gemini API is temporarily unavailable.";
          const err: AIChatErrorResponse = {
            error: msg,
            errorCode: "UNKNOWN",
            configured: true,
          };
          return json(err, 502);
        }
      },
    },
  },
});
