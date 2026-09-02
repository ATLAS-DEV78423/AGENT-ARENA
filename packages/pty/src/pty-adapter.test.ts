import { describe, it, expect, vi } from "vitest";
import { PtyAgentAdapter } from "./pty-adapter.js";

describe("PtyAgentAdapter", () => {
  it("detects review_approved from response", async () => {
    const adapter = new PtyAgentAdapter("test" as any, "Test", "echo");
    // Mock the session to return a review response
    const mockSession = {
      isAlive: () => true,
      sendAndWait: vi.fn().mockResolvedValue("LGTM, no issues found"),
    };
    (adapter as any).sessions.set("test-session", mockSession);

    const response = await adapter.sendAndReceive(
      { sessionId: "test-session" },
      "Review the implementation.",
    );
    expect(response.kind).toBe("review_approved");
  });

  it("detects finding from response", async () => {
    const adapter = new PtyAgentAdapter("test" as any, "Test", "echo");
    const mockSession = {
      isAlive: () => true,
      sendAndWait: vi.fn().mockResolvedValue("Found a critical bug: null pointer"),
    };
    (adapter as any).sessions.set("test-session", mockSession);

    const response = await adapter.sendAndReceive(
      { sessionId: "test-session" },
      "Review the implementation.",
    );
    expect(response.kind).toBe("finding");
  });

  it("returns error for unknown session", async () => {
    const adapter = new PtyAgentAdapter("test" as any, "Test", "echo");
    const response = await adapter.sendAndReceive(
      { sessionId: "unknown" },
      "hello",
    );
    expect(response.kind).toBe("error");
  });

  it("returns crash when process exited", async () => {
    const adapter = new PtyAgentAdapter("test" as any, "Test", "echo");
    const mockSession = {
      isAlive: () => false,
      sendAndWait: vi.fn(),
    };
    (adapter as any).sessions.set("test-session", mockSession);

    const response = await adapter.sendAndReceive(
      { sessionId: "test-session" },
      "hello",
    );
    expect(response.kind).toBe("crash");
  });
});
