// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { resolve } from "node:path";
import { loadEnv } from "vite";
// @ts-expect-error — plain JS helper; no declaration file needed for this build-tool script
import { syncGeminiDevVars } from "./scripts/sync-gemini-dev-vars.mjs";

function geminiEnvPlugin(): Plugin {
  return {
    name: "global-pulse-gemini-env",
    config(config, { mode }) {
      syncGeminiDevVars(config.root ?? process.cwd(), mode);
    },
    configureServer(server) {
      syncGeminiDevVars(server.config.root, server.config.mode);
    },
  };
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ mode }) => {
  const root = process.cwd();
  loadDotenv({ path: resolve(root, ".env") });
  loadDotenv({ path: resolve(root, ".env.local"), override: true });

  const env = loadEnv(mode, root, "");
  const geminiApiKey = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  const geminiModel = env.GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const geminiFallbackModel =
    env.GEMINI_FALLBACK_MODEL ?? process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.0-flash-lite";

  syncGeminiDevVars(root, mode);

  return {
    tanstackStart: {
      server: { entry: "server" },
    },
    plugins: [geminiEnvPlugin()],
    vite: {
      // Server-only: static `process.env.GEMINI_*` in getGeminiConfig() is replaced at build time.
      define: {
        "process.env.GEMINI_API_KEY": JSON.stringify(geminiApiKey),
        "process.env.GEMINI_MODEL": JSON.stringify(geminiModel),
        "process.env.GEMINI_FALLBACK_MODEL": JSON.stringify(geminiFallbackModel),
      },
    },
  };
});
