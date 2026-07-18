import { createFileRoute } from "@tanstack/react-router";
import { callGeminiChat, GeminiChatError } from "@/lib/geminiChatServer";
import type { AIChatRequestBody, LLMChatContextPayload } from "@/lib/aiChatTypes";
import { getGeminiConfig } from "@/server/geminiConfig";
import { checkRateLimit } from "@/server/rateLimiter";
import { toAiClientError } from "@/lib/userErrorMessage";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: unknown, status = 200, retryAfterSec?: number) {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return new Response(JSON.stringify(body), { status, headers });
}

type ReportGenerateBody = {
  type: string;
  country?: string;
  eventId?: string;
  draft: string;
  context: LLMChatContextPayload;
  instruction: string;
};

export const Route = createFileRoute("/api/generate-report")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: JSON_HEADERS }),
      POST: async ({ request }) => {
        // Public, unauthenticated endpoint — cap per-IP usage so the shared
        // GEMINI_API_KEY quota can't be exhausted by a single caller.
        const rate = checkRateLimit(request, "generate-report", 10, 5 * 60_000);
        if (!rate.allowed) {
          return json({ error: "Too many report requests — please wait a moment." }, 429, rate.retryAfterSec);
        }

        const { configured } = getGeminiConfig();
        if (!configured) {
          return json({ error: toAiClientError("MISSING_API_KEY"), configured: false }, 503);
        }

        let body: ReportGenerateBody;
        try {
          body = (await request.json()) as ReportGenerateBody;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        if (!body?.draft || !body.context || !body.instruction) {
          return json({ error: "draft, context, and instruction are required" }, 400);
        }
        if (body.draft.length > 64_000 || body.instruction.length > 4_000) {
          return json({ error: "Request payload too large" }, 413);
        }

        const userContent = `${body.instruction}

Use the structured draft below as your factual base. Improve clarity and formatting in Markdown. Do not invent headlines, magnitudes, or countries.

--- DRAFT REPORT ---
${body.draft}`;

        const chatBody: AIChatRequestBody = {
          messages: [{ role: "user", content: userContent }],
          context: body.context,
        };

        try {
          const result = await callGeminiChat(chatBody);
          return json({
            content: result.answer,
            model: result.model,
            status: result.status,
            provider: result.provider,
          });
        } catch (e: unknown) {
          if (e instanceof GeminiChatError) {
            console.error("[generate-report] Gemini error:", e.code, e.message);
            return json(
              {
                error: toAiClientError(e.code),
                errorCode: e.code,
                configured: e.code !== "MISSING_API_KEY",
              },
              e.httpStatus && e.httpStatus >= 400 ? e.httpStatus : 502,
            );
          }
          console.error("[generate-report] unexpected error:", e);
          return json({ error: toAiClientError() }, 502);
        }
      },
    },
  },
});
