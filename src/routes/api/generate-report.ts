import { createFileRoute } from "@tanstack/react-router";
import { callGeminiChat, GeminiChatError } from "@/lib/geminiChatServer";
import type { AIChatRequestBody, LLMChatContextPayload } from "@/lib/aiChatTypes";
import { getGeminiConfig } from "@/server/geminiConfig";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
        const { configured } = getGeminiConfig();
        if (!configured) {
          return json({ error: "GEMINI_API_KEY is missing on the server", configured: false }, 503);
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
            return json(
              {
                error: e.message,
                errorCode: e.code,
                configured: e.code !== "MISSING_API_KEY",
              },
              e.httpStatus && e.httpStatus >= 400 ? e.httpStatus : 502,
            );
          }
          return json({ error: "Report generation failed" }, 502);
        }
      },
    },
  },
});
