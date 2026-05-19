/**
 * Sync GEMINI_* from .env into `.dev.vars` for Cloudflare Miniflare (local dev).
 * Invoked from vite.config.ts — not part of the app bundle.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadEnv } from "vite";

export function syncGeminiDevVars(root, mode = "development") {
  loadDotenv({ path: resolve(root, ".env") });
  loadDotenv({ path: resolve(root, ".env.local"), override: true });

  const fromVite = loadEnv(mode, root, "");
  const apiKey = (fromVite.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY)?.trim();
  const model = (fromVite.GEMINI_MODEL ?? process.env.GEMINI_MODEL)?.trim() || "gemini-2.5-flash-lite";
  const fallbackModel =
    (fromVite.GEMINI_FALLBACK_MODEL ?? process.env.GEMINI_FALLBACK_MODEL)?.trim() ||
    "gemini-2.0-flash-lite";

  if (!apiKey) {
    console.warn("[gemini-env] GEMINI_API_KEY not found in .env — skipping .dev.vars sync");
    return;
  }

  const stripGemini = (content) =>
    content
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("GEMINI_"))
      .join("\n");

  const append = (base) => {
    const trimmed = base.trim();
    const prefix = trimmed ? `${trimmed}\n` : "";
    return `${prefix}GEMINI_API_KEY=${JSON.stringify(apiKey)}\nGEMINI_MODEL=${JSON.stringify(model)}\nGEMINI_FALLBACK_MODEL=${JSON.stringify(fallbackModel)}\n`;
  };

  for (const rel of [".dev.vars", "dist/server/.dev.vars"]) {
    const path = resolve(root, rel);
    try {
      if (rel.includes("/") && !existsSync(resolve(root, "dist/server"))) {
        mkdirSync(resolve(root, "dist/server"), { recursive: true });
      }
      const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
      writeFileSync(path, append(stripGemini(existing)), "utf8");
    } catch (e) {
      console.warn(`[gemini-env] Could not write ${rel}:`, e?.message ?? e);
    }
  }

  console.log("[gemini-env] synced GEMINI_* to .dev.vars (key length:", apiKey.length, ")");
}
