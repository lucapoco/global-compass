/**
 * Cloudflare Worker bindings → process.env bridge (server-only).
 * Populated from the `env` argument in src/server.ts fetch().
 */

let bindings: Record<string, unknown> | undefined;

export function setWorkerEnv(env: unknown): void {
  if (!env || typeof env !== "object") return;
  bindings = env as Record<string, unknown>;

  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}

/** Read a string env var from Worker bindings or process.env. */
export function readWorkerEnvString(key: string): string | undefined {
  const bound = bindings?.[key];
  if (typeof bound === "string" && bound.trim()) return bound.trim();

  const fromProcess = process.env[key];
  return typeof fromProcess === "string" && fromProcess.trim() ? fromProcess.trim() : undefined;
}
