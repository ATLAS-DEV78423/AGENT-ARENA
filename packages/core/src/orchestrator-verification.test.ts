import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { SessionManager } from "./session/manager.js";
import type { VerificationResult } from "@arena/verification";

describe("Orchestrator with verification", () => {
  it("includes verification results in reviewer prompt when configured", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const mockVerify = vi.fn().mockResolvedValue({
      passed: true,
      checks: [{ name: "test", passed: true, stdout: "5 passed", stderr: "", durationMs: 100 }],
      durationMs: 100,
    } satisfies VerificationResult);

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

    // Inject mock verification engine
    (o as any).verificationEngine = { verify: mockVerify };

    const result = await o.run();
    expect(result.outcome).toBe("consensus");
    // Verification should have been called once per round
    expect(mockVerify).toHaveBeenCalled();
    // The verification result should contain the check data
    const callResult = await mockVerify.mock.results[0]?.value;
    expect(callResult?.checks[0]?.stdout).toBe("5 passed");
  });

  it("skips verification when not configured", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");
    const o = new Orchestrator(
      { task: "Build a login form", cwd: "/tmp", maxRounds: 1, maxMinutes: 5 },
      a,
      b,
      mgr,
    );
    const result = await o.run();
    expect(result.outcome).toBe("consensus");
  });
});
