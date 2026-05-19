/**
 * Load `.env` / `.env.local` into process.env for server-side routes.
 * Imported early from server.ts; also runs when geminiConfig loads.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

function resolveEnvRoot(): string {
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, ".env"))) return cwd;

  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 8; i++) {
      if (existsSync(resolve(dir, ".env"))) return dir;
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* Workers may lack import.meta.url filesystem context */
  }

  return cwd;
}

export function loadServerEnv(): void {
  if (loaded) return;
  loaded = true;

  try {
    const root = resolveEnvRoot();
    config({ path: resolve(root, ".env") });
    config({ path: resolve(root, ".env.local"), override: true });
  } catch {
    // Cloudflare Workers without filesystem — rely on Vite define / wrangler bindings.
  }
}

/** Eager load when this module is first imported. */
loadServerEnv();
