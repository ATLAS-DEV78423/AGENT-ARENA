import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { SessionManager } from "./session/manager.js";

function createMockVerify(passFirst: boolean) {
  let callCount = 0;
  return vi.fn().mockImplementation(async () => {
    callCount++;
    return {
      passed: passFirst ? true : callCount >= 2,
      checks: [
        {
          name: "test",
          passed: passFirst ? true : callCount >= 2,
          stdout: passFirst ? "5 passed" : "2 failed: null pointer, type error",
          stderr: "",
          durationMs: 100,
        },
      ],
      durationMs: 100,
    };
  });
}

describe("Orchestrator verification gate", () => {
  it("skips reviewer when verification fails, sends failures to builder", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/tmp",
        maxRounds: 3,
        maxMinutes: 5,
        verification: {
          commands: [{ name: "test", cmd: "echo", args: ["fail"] }],
        },
      },
      a,
      b,
      mgr,
    );

    // Inject mock verification that fails
    const mockVerify = createMockVerify(false);
    (o as any).verificationEngine = { verify: mockVerify };

    const result = await o.run();

    // Verification should have been called (at least once for the fail, then again after builder fixes)
    expect(mockVerify.mock.calls.length).toBeGreaterThanOrEqual(2);

    // The session should complete (builder fixes, verification passes on second try, then reviewer approves)
    expect(result.outcome).toBe("consensus");
  });

  it("consults reviewer only when verification passes", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/tmp",
        maxRounds: 1,
        maxMinutes: 5,
        verification: {
          commands: [{ name: "test", cmd: "echo", args: ["ok"] }],
        },
      },
      a,
      b,
      mgr,
    );

    // Verification passes on first try
    const mockVerify = createMockVerify(true);
    (o as any).verificationEngine = { verify: mockVerify };

    const result = await o.run();

    // Verification called once, reviewer consulted once
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("consensus");
  });

  it("when no verification configured, reviewer is always consulted", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/tmp",
        maxRounds: 1,
        maxMinutes: 5,
        // No verification config
      },
      a,
      b,
      mgr,
    );

    const result = await o.run();
    expect(result.outcome).toBe("consensus");
  });
});
