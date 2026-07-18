/**
 * Config Vite pentru Global Compass (TanStack Start + Nitro).
 *
 * @lovable.dev/vite-tanstack-config include deja:
 *   tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build),
 *   injectare VITE_*, alias @, dedupe React/TanStack.
 *
 * Pe Vercel, Nitro detectează automat platforma (sau forțăm preset: "vercel").
 * Nu adăuga din nou aceleași pluginuri — duplicatele sparg build-ul.
 */
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { resolve } from "node:path";
import { loadEnv } from "vite";
// @ts-expect-error — helper JS fără tipuri
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

  // Pe CI Vercel forțăm preset-ul; local rămâne pe auto-detect Nitro.
  const onVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

  // Pe Vercel, GEMINI_* vin din Environment Variables la runtime — nu le „îngheța”
  // la build (altfel o cheie goală la build blochează runtime).
  const geminiDefine = onVercel
    ? {}
    : {
        "process.env.GEMINI_API_KEY": JSON.stringify(geminiApiKey),
        "process.env.GEMINI_MODEL": JSON.stringify(geminiModel),
        "process.env.GEMINI_FALLBACK_MODEL": JSON.stringify(geminiFallbackModel),
      };

  return {
    tanstackStart: {
      server: { entry: "server" },
    },
    nitro: onVercel ? { preset: "vercel" } : true,
    plugins: [geminiEnvPlugin()],
    vite: {
      define: geminiDefine,
    },
  };
});
