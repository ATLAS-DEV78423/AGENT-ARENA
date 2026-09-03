import { describe, it, expect } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { SessionManager } from "./session/manager.js";
import { agentId, SessionId } from "./types/common.js";
import { AgentRoleAssignment } from "./types/session.js";

// SessionManager whose roles are fixed (assignRoles is random by design)
class FixedRolesManager extends SessionManager {
  constructor(private fixed: [AgentRoleAssignment, AgentRoleAssignment]) {
    super();
  }
  override getRoles(_id: SessionId) {
    return this.fixed;
  }
}

function makeFakePair() {
  return [
    new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A"),
    new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B"),
  ] as const;
}

describe("E2E: full orchestrator lifecycle", () => {
  it("runs a complete session with consensus outcome", async () => {
    const [a, b] = makeFakePair();
    const orch = new Orchestrator(
      {
        task: "Build a hello world app",
        cwd: process.cwd(),
        maxRounds: 2,
        maxMinutes: 1,
      },
      a,
      b,
    );

    const result = await orch.run();
    const events = result.events.map((e) => e.type);

    // Should complete (fake agents always reach consensus)
    expect(["consensus", "timeout"]).toContain(result.outcome);
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.sessionId).toBeTruthy();

    // Key protocol events should be present
    for (const type of [
      "session.created",
      "session.initialized",
      "environment.checked",
      "analysis.started",
      "analysis.complete",
      "discussion.complete",
      "plan.approved",
      "round.started",
      "consensus.reached",
    ]) {
      expect(events).toContain(type);
    }
  });

  it("survives multi-round review findings without state-machine crash", async () => {
    const idA = agentId("agent-a");
    const idB = agentId("agent-b");
    const a = new FakeOrchestratorAdapter(idA, "Agent A");
    const b = FakeOrchestratorAdapter.withFindings(idB, "Agent B");
    // Deterministic: A builds, B reviews (B produces a finding in review)
    const mgr = new FixedRolesManager([
      { agentId: idA, role: "Builder" },
      { agentId: idB, role: "Reviewer" },
    ]);
    const orch = new Orchestrator(
      { task: "Test findings", cwd: process.cwd(), maxRounds: 2, maxMinutes: 1 },
      a,
      b,
      mgr,
    );

    const result = await orch.run();
    const findingEvents = result.events.filter((e) => e.type === "finding.created");

    // A finding was created by the reviewer
    expect(findingEvents.length).toBeGreaterThan(0);
    expect(findingEvents[0]!.data).toHaveProperty("severity");
    expect(findingEvents[0]!.data).toHaveProperty("claim");

    // Regression: the finding path across multiple rounds must NOT crash the
    // state machine (previously threw on the second round and returned "error")
    expect(result.outcome).not.toBe("error");
  });

  it("terminates all agent handles on completion", async () => {
    let aTerminated = false;
    let bTerminated = false;
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
    const origATerminate = a.terminate.bind(a);
    const origBTerminate = b.terminate.bind(b);
    a.terminate = async () => { aTerminated = true; await origATerminate(); };
    b.terminate = async () => { bTerminated = true; await origBTerminate(); };

    const orch = new Orchestrator(
      { task: "Test cleanup", cwd: process.cwd(), maxRounds: 1, maxMinutes: 1 },
      a,
      b,
    );

    await orch.run();

    expect(aTerminated).toBe(true);
    expect(bTerminated).toBe(true);
  });

  it("handles abort signal", async () => {
    const [a, b] = makeFakePair();
    const controller = new AbortController();
    const orch = new Orchestrator(
      {
        task: "Abort test",
        cwd: process.cwd(),
        maxRounds: 5,
        maxMinutes: 5,
        signal: controller.signal,
      },
      a,
      b,
    );

    // Abort before run
    controller.abort();

    const result = await orch.run();
    expect(result.outcome).toBe("error");
  });
});
