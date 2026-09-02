import { describe, it, expect } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { SessionManager } from "./session/manager.js";
import { BudgetEnforcer } from "./session/budget.js";
import { agentId } from "./types/common.js";

describe("Orchestrator budget enforcement", () => {
  it("stops early when budget is exceeded", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");

    // Create a budget that's already exceeded
    const budget = new BudgetEnforcer({ maxRounds: 0, maxMinutes: 60, maxAgentTurns: 40, maxToolCalls: 200 });
    // maxRounds=0 means canProceed() returns false immediately

    const o = new Orchestrator(
      {
        task: "Test",
        cwd: "/tmp/test",
        maxRounds: 5,
        maxMinutes: 60,
      },
      a,
      b,
      mgr,
    );

    // Inject the exhausted budget
    (o as any).budget = budget;

    const result = await o.run();
    // Budget exceeded — should return timeout, not enter the loop
    expect(result.outcome).toBe("timeout");
    expect(result.events.filter((e: any) => e.type === "round.started")).toHaveLength(0);
  });

  it("records round usage during loop", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");

    const o = new Orchestrator(
      {
        task: "Test",
        cwd: "/tmp/test",
        maxRounds: 3,
        maxMinutes: 60,
      },
      a,
      b,
      mgr,
    );

    await o.run();
    // Should have recorded rounds in the budget
    const budget = (o as any).budget as BudgetEnforcer;
    expect(budget.getUsage().rounds).toBeGreaterThanOrEqual(1);
  });
});

describe("Orchestrator analysis.started timing", () => {
  it("emits analysis.started BEFORE analysis.complete", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");

    const o = new Orchestrator(
      {
        task: "Test",
        cwd: "/tmp/test",
        maxRounds: 1,
        maxMinutes: 60,
      },
      a,
      b,
      mgr,
    );

    const result = await o.run();
    const startedIdx = result.events.findIndex((e: any) => e.type === "analysis.started");
    const completeIdx = result.events.findIndex((e: any) => e.type === "analysis.complete");
    expect(startedIdx).toBeLessThan(completeIdx);
  });
});
