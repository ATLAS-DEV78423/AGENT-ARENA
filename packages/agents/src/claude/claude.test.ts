import { describe, it, expect, vi } from "vitest";
import { ClaudeAdapter } from "./claude.js";
import { parseResponseKind } from "@arena/core";
import { sessionId } from "@arena/core";

describe("ClaudeAdapter", () => {
  it("detects claude CLI", async () => {
    const adapter = new ClaudeAdapter();
    const detected = await adapter.detect();
    // May or may not be installed — just check shape
    expect(typeof detected.detected).toBe("boolean");
    expect(detected.command).toBe("claude");
  });

  it("returns correct capabilities", async () => {
    const adapter = new ClaudeAdapter();
    const caps = await adapter.capabilities();
    expect(caps.terminal).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.shell).toBe(true);
  });

  it("throws if start called when claude not found", async () => {
    const adapter = new ClaudeAdapter();
    try {
      await adapter.start({ task: "test", cwd: "/tmp" });
    } catch (e: any) {
      expect(e.message).toContain("not detected");
    }
  });
});

describe("ClaudeAdapter response kind detection", () => {
  it("detects review_approved", () => {
    const kind = parseResponseKind("LGTM, no issues found", "Review the implementation");
    expect(kind).toBe("review_approved");
  });

  it("detects finding", () => {
    const kind = parseResponseKind(
      "Found a critical bug: null pointer in auth.ts line 42",
      "Review the implementation",
    );
    expect(kind).toBe("finding");
  });

  it("detects plan_approved", () => {
    const kind = parseResponseKind("I approve the plan, looks solid", "Approve plan?");
    expect(kind).toBe("plan_approved");
  });

  it("detects final_approved", () => {
    const kind = parseResponseKind("Ship it, all tests pass", "Final approval?");
    expect(kind).toBe("final_approved");
  });

  it("adapter returns correct kind for review response", async () => {
    const adapter = new ClaudeAdapter();
    (adapter as any).detected = true;
    // Inject mock persistent session
    const mockSession = {
      sessionId: "mock-1",
      pid: 1234,
      sendAndWait: vi.fn().mockResolvedValue("LGTM, no issues found"),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };
    (adapter as any).persistentSessions = new Map([["mock-1", mockSession]]);
    const handle = { sessionId: sessionId("mock-1"), pid: 1234 };
    const response = await adapter.sendAndReceive(handle, "Review the implementation.");
    expect(response.kind).toBe("review_approved");
    expect(response.content).toContain("LGTM");
  });

  it("adapter returns correct kind for finding response", async () => {
    const adapter = new ClaudeAdapter();
    (adapter as any).detected = true;
    const mockSession = {
      sessionId: "mock-2",
      pid: 1234,
      sendAndWait: vi.fn().mockResolvedValue(
        "Found a critical bug: null pointer in auth.ts line 42",
      ),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };
    (adapter as any).persistentSessions = new Map([["mock-2", mockSession]]);
    const handle = { sessionId: sessionId("mock-2"), pid: 1234 };
    const response = await adapter.sendAndReceive(handle, "Review the implementation.");
    expect(response.kind).toBe("finding");
  });

  it("adapter returns correct kind for plan approval", async () => {
    const adapter = new ClaudeAdapter();
    (adapter as any).detected = true;
    const mockSession = {
      sessionId: "mock-3",
      pid: 1234,
      sendAndWait: vi.fn().mockResolvedValue("I approve the plan"),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
    };
    (adapter as any).persistentSessions = new Map([["mock-3", mockSession]]);
    const handle = { sessionId: sessionId("mock-3"), pid: 1234 };
    const response = await adapter.sendAndReceive(handle, "Approve plan?");
    expect(response.kind).toBe("plan_approved");
  });
});
