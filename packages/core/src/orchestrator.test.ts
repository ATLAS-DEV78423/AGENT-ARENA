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
