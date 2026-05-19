/**
 * Server-only Gemini configuration. Never import from client components.
 */
import "@/server/loadServerEnv";
import { readWorkerEnvString } from "@/server/workerEnv";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.0-flash-lite";

export type GeminiConfig = {
  apiKey?: string;
  model: string;
  fallbackModel?: string;
  configured: boolean;
  keyLength: number;
};

let debugLogged = false;

function readGeminiApiKey(): string | undefined {
  const fromDefine = process.env.GEMINI_API_KEY;
  if (typeof fromDefine === "string" && fromDefine.trim()) {
    return fromDefine.trim();
  }
  return readWorkerEnvString("GEMINI_API_KEY");
}

function readGeminiModel(): string {
  const fromDefine = process.env.GEMINI_MODEL;
  if (typeof fromDefine === "string" && fromDefine.trim()) {
    return fromDefine.trim();
  }
  return readWorkerEnvString("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

function readGeminiFallbackModel(): string | undefined {
  const fromDefine = process.env.GEMINI_FALLBACK_MODEL;
  if (typeof fromDefine === "string" && fromDefine.trim()) {
    return fromDefine.trim();
  }
  return readWorkerEnvString("GEMINI_FALLBACK_MODEL") || DEFAULT_GEMINI_FALLBACK_MODEL;
}

/** @deprecated Use getGeminiConfig */
export function readGeminiConfig(): GeminiConfig {
  return getGeminiConfig();
}

export function getGeminiConfig(): GeminiConfig {
  const apiKey = readGeminiApiKey();
  const model = readGeminiModel();
  const fallbackModel = readGeminiFallbackModel();
  const configured = Boolean(apiKey);
  const keyLength = apiKey?.length ?? 0;

  const isDev =
    (typeof import.meta !== "undefined" && import.meta.env?.DEV) ||
    process.env.NODE_ENV === "development";

  if (isDev && !debugLogged) {
    debugLogged = true;
    console.log(
      "[Gemini] configured:",
      configured,
      "primary:",
      model,
      "fallback:",
      fallbackModel ?? "(none)",
      "key length:",
      keyLength,
    );
  }

  return { apiKey, model, fallbackModel, configured, keyLength };
}
