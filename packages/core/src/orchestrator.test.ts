import { describe, it, expect } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { agentId } from "./types/common.js";
import { SessionManager } from "./session/manager.js";

describe("Orchestrator - full protocol", () => {
  it("completes happy path: analysis -> discussion -> plan -> build/review -> consensus", async () => {
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
    const orch = new Orchestrator(
      { task: "Build feature X", cwd: "/tmp" }, a, b,
    );
    const result = await orch.run();
    expect(result.outcome).toBe("consensus");
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.state).toMatch(/CONSENSUS|COMPLETED/);
    // Verify events were emitted
    expect(result.events.some(e => e.type === "analysis.complete")).toBe(true);
    expect(result.events.some(e => e.type === "plan.approved")).toBe(true);
    expect(result.events.some(e => e.type === "round.started")).toBe(true);
    expect(result.events.some(e => e.type === "consensus.reached")).toBe(true);
  });

  it("handles plan rejection -> timeout", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = FakeOrchestratorAdapter.disagreeing(agentId("b"), "B");
    const orch = new Orchestrator({ task: "Build X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("timeout");
    expect(result.events.some(e => e.type === "plan.rejected" || e.state === "PLAN_REJECTED")).toBe(true);
  });

  it("terminates agents after completion", async () => {
    const terminated: string[] = [];
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const origTermA = a.terminate.bind(a);
    a.terminate = async () => { terminated.push("A"); };
    b.terminate = async () => { terminated.push("B"); };
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    await orch.run();
    expect(terminated).toContain("A");
    expect(terminated).toContain("B");
  });

  it("emits correct state transitions", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    const states = result.events.map(e => e.state);
    // Must go through key states
    expect(states).toContain("INITIALIZING");
    expect(states).toContain("ANALYZING");
    expect(states).toContain("DISCUSSING");
    expect(states).toContain("IMPLEMENTING");
    expect(states).toContain("REVIEWING");
  });

  it("respects maxRounds config", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp", maxRounds: 1 }, a, b);
    const result = await orch.run();
    expect(result.rounds).toBeLessThanOrEqual(1);
  });
});
