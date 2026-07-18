/**
 * Configuratie Gemini doar pe server. Nu importa din componente client.
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

export function getGeminiConfig(): GeminiConfig {
  const apiKey = readGeminiApiKey();
  const model = readGeminiModel();
  const fallbackModel = readGeminiFallbackModel();
  const configured = Boolean(apiKey);
  const keyLength = apiKey?.length ?? 0;
  return { apiKey, model, fallbackModel, configured, keyLength };
}
