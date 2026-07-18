import { describe, expect, it } from "vitest";
import { toUserMessage, toAiClientError } from "@/lib/userErrorMessage";

describe("userErrorMessage", () => {
  it("maps AI error codes to safe messages", () => {
    expect(toAiClientError("RATE_LIMIT")).toContain("busy");
    expect(toAiClientError("MISSING_API_KEY")).toBeTruthy();
  });

  it("returns a string for unknown errors", () => {
    expect(toUserMessage(null)).toBeTruthy();
  });
});
