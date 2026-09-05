import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { EventStore } from "./persistence/event-store.js";
import { agentId } from "./types/common.js";

describe("Orchestrator - full protocol", () => {
  it("completes happy path: analysis -> discussion -> plan -> build/review -> consensus", async () => {
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
    const orch = new Orchestrator({ task: "Build feature X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("consensus");
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.state).toMatch(/CONSENSUS|COMPLETED/);
    expect(result.events.some((e) => e.type === "analysis.complete")).toBe(true);
    expect(result.events.some((e) => e.type === "plan.approved")).toBe(true);
    expect(result.events.some((e) => e.type === "round.started")).toBe(true);
    expect(result.events.some((e) => e.type === "consensus.reached")).toBe(true);
  });

  it("handles plan rejection -> timeout", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = FakeOrchestratorAdapter.disagreeing(agentId("b"), "B");
    const orch = new Orchestrator({ task: "Build X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("timeout");
    expect(
      result.events.some(
        (e) => e.type === "plan.rejected" || e.state === "AWAITING_PLAN_APPROVAL",
      ),
    ).toBe(true);
  });

  it("attributes a plan rejection to the side that stayed silent", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B", [
      { trigger: "independently", response: { kind: "analysis", content: "Analysis." } },
      { trigger: "review their", response: { kind: "message", content: "Noted." } },
      { trigger: "approve only", response: { kind: "timeout", content: "B did not respond in time" } },
    ]);
    const orch = new Orchestrator({ task: "Build X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("timeout");
    const rejected = result.events.find((e) => e.type === "plan.rejected");
    expect(rejected?.data).toEqual({ agentId: "b", noResponse: true });
  });

  it("terminates agents after completion", async () => {
    const terminated: string[] = [];
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    a.terminate = async () => {
      terminated.push("A");
    };
    b.terminate = async () => {
      terminated.push("B");
    };
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    await orch.run();
    expect(terminated).toContain("A");
    expect(terminated).toContain("B");
  });

  it("emits correct state transitions through key states", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    const states = result.events.map((e) => e.state);
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

  it("includes sessionId in result", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(typeof result.sessionId).toBe("string");
    expect(result.sessionId.length).toBeGreaterThan(0);
  });
});

describe("Orchestrator - EventStore persistence", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("persists events to EventStore when provided", async () => {
    dir = mkdtempSync(join(tmpdir(), "arena-test-"));
    const eventStore = new EventStore(dir);
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp" }, a, b, undefined, eventStore,
    );
    const result = await orch.run();

    const persisted = await eventStore.load(result.sessionId as string);
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted[0]?.type).toBe("session.created");
    expect(persisted.some((e) => e.type === "plan.approved")).toBe(true);
    expect(persisted.some((e) => e.type === "consensus.reached")).toBe(true);
  });

  it("works without EventStore (no persistence, no crash)", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("consensus");
  });
});

describe("Orchestrator - onEvent consumer hook", () => {
  it("delivers every emitted event to the onEvent callback", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const received: string[] = [];
    const orch = new Orchestrator(
      {
        task: "X",
        cwd: "/tmp",
        onEvent: (e) => received.push(e.type),
      },
      a,
      b,
    );
    await orch.run();

    expect(received).toContain("session.created");
    expect(received).toContain("analysis.complete");
    expect(received).toContain("consensus.reached");
  });

  it("onEvent payload matches the events recorded in the result", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const received: Array<{ type: string; state: string; agentId?: string }> = [];
    const orch = new Orchestrator(
      {
        task: "X",
        cwd: "/tmp",
        onEvent: (e) => received.push({ type: e.type, state: e.state, agentId: e.agentId }),
      },
      a,
      b,
    );
    const result = await orch.run();

    expect(received).toHaveLength(result.events.length);
    expect(received[0]?.type).toBe(result.events[0]?.type);
  });
});

describe("Orchestrator - structured discussion events", () => {
  it("emits message.created events during discussion", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();

    const msgEvents = result.events.filter(
      (e) => e.type === "message.created",
    );
    expect(msgEvents.length).toBeGreaterThanOrEqual(2);
    expect(msgEvents.some((e) => e.agentId === agentId("a"))).toBe(true);
    expect(msgEvents.some((e) => e.agentId === agentId("b"))).toBe(true);
  });
});

describe("Orchestrator - Finding integration", () => {
  let origRandom: () => number;

  afterEach(() => {
    Math.random = origRandom;
  });

  it("creates finding during review when reviewer reports issue", async () => {
    origRandom = Math.random;
    Math.random = () => 0; // Agent A = Builder first

    const builder = new FakeOrchestratorAdapter(agentId("a"), "Builder");
    const reviewer = FakeOrchestratorAdapter.withFindings(
      agentId("b"), "Reviewer",
    );
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 1 }, builder, reviewer,
    );
    const result = await orch.run();

    expect(result.outcome).toBe("consensus");
    const findingEvents = result.events.filter(
      (e) => e.type === "finding.created",
    );
    expect(findingEvents.length).toBeGreaterThanOrEqual(1);
    expect(findingEvents[0]?.data?.severity).toBe("blocker");
  });

  it("survives a reviewer rejection: REVISING in round 1, role-reversed round 2 still reaches consensus", async () => {
    // Regression: findings_presented once fired from VERIFYING and crashed the
    // state machine mid-run (see arena-test.log / MISTAKES.md). This pins the
    // full two-round path: reject -> REVISING -> resolve -> role swap -> approve.
    origRandom = origRandom ?? Math.random;
    Math.random = () => 0; // Agent A = Builder round 1, B = Reviewer

    const builder = new FakeOrchestratorAdapter(agentId("a"), "Builder");
    const reviewer = FakeOrchestratorAdapter.withFindings(
      agentId("b"), "Reviewer",
    );
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 2 }, builder, reviewer,
    );
    const result = await orch.run();

    expect(result.outcome).toBe("consensus");
    expect(result.rounds).toBe(2);
    expect(result.events.some((e) => e.type === "error")).toBe(false);

    // Round 1 files the finding post-transition (REVIEWING → REVISING),
    // per the transition-then-emit convention — never from VERIFYING, which
    // is what crashed before e17379e.
    const finding = result.events.find((e) => e.type === "finding.created");
    expect(finding?.state).toBe("REVISING");
    expect(finding?.data?.severity).toBe("blocker");

    // Round 1 revises: exactly the finding event + the fix turn's thinking
    // announcement carry REVISING, then round 2 swaps the roles.
    expect(
      result.events.filter((e) => e.state === "REVISING").map((e) => e.type),
    ).toEqual(["finding.created", "agent.thinking"]);
    const rounds = result.events.filter((e) => e.type === "round.started");
    expect(rounds[0]?.data?.builder).toBe(agentId("a"));
    expect(rounds[1]?.data?.builder).toBe(agentId("b"));
    expect(rounds[1]?.data?.reviewer).toBe(agentId("a"));

    // Round 2 approves: same reviewer-now-Builder flow, consensus at the end.
    expect(result.events.some((e) => e.type === "consensus.reached")).toBe(true);
    expect(result.state).toMatch(/CONSENSUS|COMPLETED/);
  });
});

describe("Orchestrator - agent.thinking progress events", () => {
  it("announces every agent turn in order, with a phase, before the call", async () => {
    // Record the real order of adapter calls across both agents.
    const order: string[] = [];
    class RecordingAdapter extends FakeOrchestratorAdapter {
      override async sendAndReceive(
        handle: { sessionId: string },
        message: string,
      ) {
        order.push(this.id);
        return super.sendAndReceive(handle, message);
      }
    }
    const a = new RecordingAdapter(agentId("agent-a"), "Agent A");
    const b = new RecordingAdapter(agentId("agent-b"), "Agent B");
    const orch = new Orchestrator(
      { task: "Build X", cwd: "/tmp", maxRounds: 1 },
      a,
      b,
    );
    const result = await orch.run();

    const thinking = result.events.filter(
      (e) => e.type === "agent.thinking",
    );
    // One announcement per real adapter call, same agent, same order:
    // no turn happens without its announcement and no announcement is idle.
    expect(thinking.length).toBe(order.length);
    expect(thinking.length).toBeGreaterThan(0);
    expect(thinking.map((e) => e.agentId)).toEqual(order);

    // Every announcement carries a known phase name.
    const phases = thinking.map((e) => String(e.data?.phase));
    for (const phase of phases) {
      expect([
        "analysis", "discussion", "plan", "build", "fix", "review", "final",
      ]).toContain(phase);
    }

    // Independent analysis runs Agent A first, then Agent B.
    expect(order[0]).toBe(agentId("agent-a"));
    expect(order[1]).toBe(agentId("agent-b"));
  });
});

describe("Orchestrator - Deadlock detection", () => {
  it("detects deadlock when both agents reject plan repeatedly", async () => {
    const a = FakeOrchestratorAdapter.disagreeing(agentId("a"), "A");
    const b = FakeOrchestratorAdapter.disagreeing(agentId("b"), "B");
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 3, maxRepeatedObjections: 2 },
      a, b,
    );
    const result = await orch.run();

    expect(result.outcome).toBe("timeout");
    expect(result.events.some((e) => e.type === "dispute.opened")).toBe(true);
  });
});
