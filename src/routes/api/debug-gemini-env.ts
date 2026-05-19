import { createFileRoute } from "@tanstack/react-router";
import { getGeminiConfig } from "@/server/geminiConfig";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const Route = createFileRoute("/api/debug-gemini-env")({
  server: {
    handlers: {
      GET: async () => {
        if (!import.meta.env.DEV) {
          return new Response(JSON.stringify({ error: "Not available in production" }), {
            status: 404,
            headers: JSON_HEADERS,
          });
        }

        const { configured, model, keyLength } = getGeminiConfig();
        return new Response(
          JSON.stringify({
            configured,
            model,
            keyLength,
          }),
          { status: 200, headers: JSON_HEADERS },
        );
      },
    },
  },
});
