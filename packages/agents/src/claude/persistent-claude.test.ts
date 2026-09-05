import { describe, it, expect, vi } from "vitest";
import { ClaudeAdapter } from "./claude.js";
import { sessionId } from "@arena/core";

const ptyMock = vi.hoisted(() => ({ lastSpawnEnv: null as Record<string, string> | null }));

vi.mock("@arena/pty", () => {
  class MockPersistentSession {
    sessionId = "mock-session";
    pid = 1234;
    constructor(config: { env?: Record<string, string> }) {
      ptyMock.lastSpawnEnv = config.env ?? null;
    }
    isAlive() { return true; }
    kill() {}
    sendAndWait() { return Promise.resolve("ok"); }
  }
  return { PersistentSession: MockPersistentSession };
});

/** Injects a live mock session and returns it with the handle that addresses it. */
function sessionWithAdapter(adapter: ClaudeAdapter, sessionKey = "test-persistent") {
  (adapter as any).detected = true;
  const mockSession = {
    sessionId: sessionKey,
    pid: 1234,
    sendAndWait: vi.fn().mockResolvedValue("LGTM, no issues found"),
    kill: vi.fn(),
    isAlive: vi.fn().mockReturnValue(true),
  };
  (adapter as any).persistentSessions = new Map();
  (adapter as any).persistentSessions.set(sessionKey, mockSession);
  return { mockSession, handle: { sessionId: sessionId(sessionKey), pid: 1234 } };
}

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

  it("gives the first call on a session the cold-start budget, later calls the steady one", async () => {
    const adapter = new ClaudeAdapter();
    const { mockSession, handle } = sessionWithAdapter(adapter);

    const first = await adapter.sendAndReceive(handle, "Analyse the task.");
    const second = await adapter.sendAndReceive(handle, "Review the implementation.");

    expect(mockSession.sendAndWait).toHaveBeenNthCalledWith(
      1,
      "Analyse the task.\n__ARENA_PROMPT_END__",
      300_000,
    );
    expect(mockSession.sendAndWait).toHaveBeenNthCalledWith(
      2,
      "Review the implementation.\n__ARENA_PROMPT_END__",
      120_000,
    );
    expect(first.kind).toBeDefined();
    expect(second.kind).toBeDefined();
  });

  it("honours custom per-model budgets and passes them to the relay process", async () => {
    const adapter = new ClaudeAdapter({ timeoutMs: 42_000, firstCallTimeoutMs: 99_000 });
    const { mockSession, handle } = sessionWithAdapter(adapter);

    await adapter.sendAndReceive(handle, "Analyse.");
    expect(mockSession.sendAndWait).toHaveBeenCalledWith("Analyse.\n__ARENA_PROMPT_END__", 99_000);

    await adapter.start({ task: "test", cwd: "/tmp" });
    expect(ptyMock.lastSpawnEnv).toMatchObject({
      ARENA_TIMEOUT: "42000",
      ARENA_FIRST_CALL_TIMEOUT: "99000",
    });
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
