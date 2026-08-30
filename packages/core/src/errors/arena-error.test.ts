import { describe, it, expect } from "vitest";
import { ArenaError, ErrorCode, createError } from "./arena-error.js";

describe("ArenaError", () => {
  it("creates error with code and message", () => {
    const e = createError(ErrorCode.AGENT_NOT_FOUND, "Codex not installed");
    expect(e.code).toBe("ARENA_AGENT_NOT_FOUND");
    expect(e.message).toBe("Codex not installed");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ArenaError);
  });

  it("marks recoverable errors", () => {
    expect(createError(ErrorCode.AGENT_TIMEOUT, "timeout").recoverable).toBe(true);
    expect(createError(ErrorCode.AGENT_CRASHED, "crash").recoverable).toBe(true);
  });

  it("marks non-recoverable errors", () => {
    expect(createError(ErrorCode.INTERNAL, "bug").recoverable).toBe(false);
  });

  it("formats user message", () => {
    const e = createError(ErrorCode.AGENT_NOT_FOUND, "Not found", { suggestion: "Run: arena doctor" });
    expect(e.toUserMessage()).toContain("ARENA_AGENT_NOT_FOUND");
    expect(e.toUserMessage()).toContain("Run: arena doctor");
  });
});
