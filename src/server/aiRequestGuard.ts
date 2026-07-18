/**
 * Validates AI chat / report request bodies — size caps and shape checks.
 */
import type { AIChatRequestBody } from "@/lib/aiChatTypes";

const MAX_BODY_BYTES = 96_000;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_DRAFT_CHARS = 64_000;

export interface AiBodyValidation {
  ok: true;
  body: AIChatRequestBody;
}

export interface AiBodyValidationError {
  ok: false;
  error: string;
  status: number;
}

export async function validateAiChatBody(
  request: Request,
): Promise<AiBodyValidation | AiBodyValidationError> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false, error: "Request body too large.", status: 413 };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON body.", status: 400 };
  }

  const body = raw as AIChatRequestBody;
  if (!body?.messages?.length || !body.context) {
    return { ok: false, error: "messages and context are required.", status: 400 };
  }

  if (body.messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Too many messages (max ${MAX_MESSAGES}).`, status: 400 };
  }

  for (const msg of body.messages) {
    if (!msg?.role || typeof msg.content !== "string") {
      return { ok: false, error: "Each message must have role and content.", status: 400 };
    }
    if (msg.content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `Message too long (max ${MAX_MESSAGE_CHARS} characters).`, status: 400 };
    }
  }

  const last = body.messages[body.messages.length - 1];
  if (last.role !== "user" || !last.content.trim()) {
    return { ok: false, error: "Last message must be a non-empty user message.", status: 400 };
  }

  return { ok: true, body };
}

export async function validateReportBody(
  request: Request,
): Promise<{ ok: true; draft: string; instruction?: string; type?: string } | AiBodyValidationError> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false, error: "Request body too large.", status: 413 };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON body.", status: 400 };
  }

  const body = raw as { draft?: string; instruction?: string; type?: string };
  if (!body?.draft?.trim()) {
    return { ok: false, error: "draft is required.", status: 400 };
  }
  if (body.draft.length > MAX_DRAFT_CHARS) {
    return { ok: false, error: `Draft too long (max ${MAX_DRAFT_CHARS} characters).`, status: 400 };
  }
  if (body.instruction && body.instruction.length > 4_000) {
    return { ok: false, error: "instruction too long.", status: 400 };
  }

  return { ok: true, draft: body.draft, instruction: body.instruction, type: body.type };
}
