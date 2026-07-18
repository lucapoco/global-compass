/**
 * Server-only Google Gemini API calls for Global Pulse AI.
 * Never import this file from client components.
 */

import { buildFullSystemMessage } from "@/lib/platformPrompt";
import type { AIChatRequestBody, AIChatSuccessResponse, LLMChatContextPayload } from "@/lib/aiChatTypes";
import { getGeminiConfig } from "@/server/geminiConfig";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_HISTORY_TURNS = 10;
/** Hard cap on a single Gemini HTTP round-trip (ms). */
const REQUEST_TIMEOUT_MS = 45_000;
/** After the first attempt, wait before retries 1–3 (ms). */
const RETRY_DELAYS_MS = [800, 1600, 3000] as const;

export type GeminiErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "BAD_REQUEST"
  | "RATE_LIMIT"
  | "HIGH_DEMAND"
  | "NETWORK"
  | "MALFORMED_RESPONSE"
  | "UNKNOWN";

export class GeminiChatError extends Error {
  readonly code: GeminiErrorCode;
  readonly httpStatus?: number;
  readonly retryCount?: number;

  constructor(message: string, code: GeminiErrorCode, httpStatus?: number, retryCount?: number) {
    super(message);
    this.name = "GeminiChatError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryCount = retryCount;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimHistory(messages: AIChatRequestBody["messages"]) {
  return messages.slice(-MAX_HISTORY_TURNS);
}

function toGeminiRole(role: "user" | "assistant"): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

function classifyHttpError(status: number, detail: string): GeminiChatError {
  const lower = detail.toLowerCase();
  if (status === 401 || status === 403) {
    return new GeminiChatError("Gemini API key is invalid or not authorized.", "INVALID_API_KEY", status);
  }
  if (status === 400) {
    return new GeminiChatError(
      detail ? `Gemini rejected the request: ${detail}` : "Gemini rejected the request.",
      "BAD_REQUEST",
      status,
    );
  }
  if (status === 429) {
    return new GeminiChatError("Gemini quota or rate limit reached.", "RATE_LIMIT", status);
  }
  if (status === 503 || lower.includes("high demand")) {
    return new GeminiChatError(
      detail || "This model is currently experiencing high demand.",
      "HIGH_DEMAND",
      status,
    );
  }
  const msg = detail ? `Gemini request failed (${status}): ${detail}` : `Gemini request failed (${status}).`;
  return new GeminiChatError(msg, status >= 500 ? "HIGH_DEMAND" : "UNKNOWN", status);
}

function isRetryableError(err: GeminiChatError): boolean {
  return err.code === "HIGH_DEMAND" || err.code === "RATE_LIMIT" || err.code === "NETWORK";
}

function shouldTryFallbackModel(err: GeminiChatError): boolean {
  return err.code === "HIGH_DEMAND" || err.code === "RATE_LIMIT";
}

type GeminiPayload = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  modelVersion?: string;
  error?: { message?: string; status?: string; code?: number };
};

async function callGeminiOnce(
  apiKey: string,
  model: string,
  systemContent: string,
  contents: { role: "user" | "model"; parts: { text: string }[] }[],
): Promise<{ answer: string; model: string }> {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemContent }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1400,
        },
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new GeminiChatError("Gemini request timed out.", "NETWORK");
    }
    throw new GeminiChatError("Could not reach Gemini API.", "NETWORK");
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: GeminiPayload;
  try {
    payload = (await res.json()) as GeminiPayload;
  } catch {
    throw new GeminiChatError("Gemini returned an unexpected response.", "MALFORMED_RESPONSE");
  }

  if (!res.ok) {
    throw classifyHttpError(res.status, payload.error?.message ?? "");
  }

  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!answer) {
    throw new GeminiChatError("Gemini returned an unexpected response.", "MALFORMED_RESPONSE");
  }

  return { answer, model: payload.modelVersion ?? model };
}

async function callModelWithRetries(
  apiKey: string,
  model: string,
  systemContent: string,
  contents: { role: "user" | "model"; parts: { text: string }[] }[],
): Promise<{ answer: string; model: string; retryCount: number }> {
  const maxAttempts = 1 + RETRY_DELAYS_MS.length;
  let lastError: GeminiChatError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    }

    try {
      const result = await callGeminiOnce(apiKey, model, systemContent, contents);
      return { ...result, retryCount: attempt };
    } catch (e) {
      if (!(e instanceof GeminiChatError)) throw e;
      lastError = e;
      if (!isRetryableError(e) || attempt >= maxAttempts - 1) {
        break;
      }
    }
  }

  throw new GeminiChatError(
    lastError?.message ?? "Gemini request failed.",
    lastError?.code ?? "UNKNOWN",
    lastError?.httpStatus,
    maxAttempts - 1,
  );
}

export async function callGeminiChat(body: AIChatRequestBody): Promise<AIChatSuccessResponse> {
  const { apiKey, model, fallbackModel, configured } = getGeminiConfig();
  if (!configured || !apiKey) {
    throw new GeminiChatError("GEMINI_API_KEY is missing on the server.", "MISSING_API_KEY");
  }

  const systemContent = buildFullSystemMessage(body.context);
  const contents = trimHistory(body.messages).map((m) => ({
    role: toGeminiRole(m.role),
    parts: [{ text: m.content }],
  }));

  let primaryError: GeminiChatError | null = null;

  try {
    const primary = await callModelWithRetries(apiKey, model, systemContent, contents);
    return {
      answer: primary.answer,
      model: primary.model,
      provider: "Google Gemini",
      status: "GEMINI LIVE",
      retryCount: primary.retryCount,
      usedContext: summarizeUsedContext(body.context),
    };
  } catch (e) {
    if (!(e instanceof GeminiChatError)) throw e;
    primaryError = e;
  }

  const canUseFallback =
    fallbackModel &&
    fallbackModel !== model &&
    primaryError &&
    shouldTryFallbackModel(primaryError);

  if (canUseFallback) {
    try {
      const fb = await callModelWithRetries(apiKey, fallbackModel, systemContent, contents);
      return {
        answer: fb.answer,
        model: fb.model,
        provider: "Google Gemini",
        status: "GEMINI FALLBACK MODEL",
        retryCount: (primaryError?.retryCount ?? 0) + fb.retryCount,
        usedContext: summarizeUsedContext(body.context),
      };
    } catch {
      /* fallback eșuat — se propagă primaryError mai jos */
    }
  }

  if (primaryError) {
    if (shouldTryFallbackModel(primaryError)) {
      throw new GeminiChatError(
        "Gemini is temporarily busy (high demand). Please try again shortly.",
        "HIGH_DEMAND",
        primaryError.httpStatus ?? 503,
        primaryError.retryCount,
      );
    }
    throw primaryError;
  }

  throw new GeminiChatError("Gemini request failed.", "UNKNOWN");
}

export function summarizeUsedContext(ctx: LLMChatContextPayload) {
  return {
    newsItems: ctx.intelligenceItems.length,
    alerts: ctx.criticalAlerts.length,
    earthquakes: ctx.earthquakes.length,
    dataStatus: ctx.dataStatus.overall,
  };
}
