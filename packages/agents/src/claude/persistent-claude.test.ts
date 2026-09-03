import { describe, it, expect, vi } from "vitest";
import { ClaudeAdapter } from "./claude.js";
import { sessionId } from "@arena/core";

vi.mock("@arena/pty", () => {
  class MockPersistentSession {
    sessionId = "mock-session";
    pid = 1234;
    isAlive() { return true; }
    kill() {}
    sendAndWait() { return Promise.resolve("ok"); }
  }
  return { PersistentSession: MockPersistentSession };
});

describe("ClaudeAdapter persistent sessions", () => {
  it("implements OrchestratorAdapter interface", () => {
    const adapter = new ClaudeAdapter();
    // Check it has the required methods
    expect(typeof adapter.start).toBe("function");
    expect(typeof adapter.sendAndReceive).toBe("function");
    expect(typeof adapter.terminate).toBe("function");
  });

  it("creates a PersistentSession on start", async () => {
    const adapter = new ClaudeAdapter();
    (adapter as any).detected = true;

    const handle = await adapter.start({ task: "test", cwd: "/tmp" });
    expect(handle.sessionId).toBe("mock-session");
    expect(handle.pid).toBe(1234);
    expect((adapter as any).persistentSessions.size).toBe(1);
  });

  it("sends message via PersistentSession and detects response kind", async () => {
    const adapter = new ClaudeAdapter();
    (adapter as any).detected = true;

    // Create a mock session
    const mockSession = {
      sessionId: "test-persistent",
      pid: 1234,
      sendAndWait: vi.fn().mockResolvedValue("LGTM, no issues found"),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };

    // Inject mock session
    (adapter as any).persistentSessions = new Map();
    (adapter as any).persistentSessions.set("test-persistent", mockSession);

    const handle = { sessionId: sessionId("test-persistent"), pid: 1234 };
    const response = await adapter.sendAndReceive(handle, "Review the implementation.");

    expect(mockSession.sendAndWait).toHaveBeenCalledWith("Review the implementation.\n__ARENA_PROMPT_END__", 120_000);
    expect(response.kind).toBe("review_approved");
    expect(response.content).toContain("LGTM");
  });

  it("terminates PersistentSession on terminate()", async () => {
    const adapter = new ClaudeAdapter();
    const mockSession = {
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };
    (adapter as any).persistentSessions = new Map();
    (adapter as any).persistentSessions.set("test", mockSession);

    await adapter.terminate({ sessionId: sessionId("test"), pid: 0 });
    expect(mockSession.kill).toHaveBeenCalled();
  });

  it("returns crash when session process exits", async () => {
    const adapter = new ClaudeAdapter();
    const mockSession = {
      sendAndWait: vi.fn(),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(false),
    };
    (adapter as any).persistentSessions = new Map();
    (adapter as any).persistentSessions.set("test", mockSession);

    const response = await adapter.sendAndReceive(
      { sessionId: sessionId("test"), pid: 0 },
      "hello",
    );
    expect(response.kind).toBe("crash");
  });

  it("returns timeout when session times out", async () => {
    const adapter = new ClaudeAdapter();
    const mockSession = {
      sendAndWait: vi.fn().mockRejectedValue(new Error("timeout")),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };
    (adapter as any).persistentSessions = new Map();
    (adapter as any).persistentSessions.set("test", mockSession);

    const response = await adapter.sendAndReceive(
      { sessionId: sessionId("test"), pid: 0 },
      "hello",
    );
    expect(response.kind).toBe("timeout");
  });
});
