import { describe, expect, it } from "vitest";
import type { OrchestratorEvent } from "@arena/core";
import {
  translateArenaEvent,
  type ArenaEventAction,
  type ArenaEventNames,
} from "./events";

const NAMES: ArenaEventNames = {
  resolveName: (id) =>
    ({ A: "Claude", B: "GPT", R: "Reviewer" })[id as "A" | "B" | "R"],
  agentA: { id: "A", name: "Claude" },
  agentB: { id: "B", name: "GPT" },
};

function event(type: string, data?: Record<string, unknown>, agentId?: string): OrchestratorEvent {
  return {
    type,
    state: "DISCUSSING" as OrchestratorEvent["state"],
    agentId: agentId as OrchestratorEvent["agentId"],
    data,
    timestamp: "2026-01-01T00:00:00Z",
  };
}

function kinds(actions: ArenaEventAction[] | null): string[] | null {
  return actions === null ? null : actions.map((a) => a.kind);
}

describe("translateArenaEvent — every orchestrator event reaches a destination", () => {
  it("agent.thinking maps to a phase update naming the agent", () => {
    const actions = translateArenaEvent(
      event("agent.thinking", { phase: "analysis" }, "A"),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "phase", phase: { phase: "analysis", agentId: "A", agentName: "Claude" } },
    ]);
  });

  it("analysis.complete maps both answers to chats in positional agent order", () => {
    const actions = translateArenaEvent(
      event("analysis.complete", { agentA: "Alpha", agentB: "Beta" }),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "chat", message: { role: "arena", agentId: "A", agentName: "Claude", content: "Alpha" } },
      { kind: "chat", message: { role: "arena", agentId: "B", agentName: "GPT", content: "Beta" } },
    ]);
  });

  it("analysis.complete with a missing side only chats what exists", () => {
    const actions = translateArenaEvent(event("analysis.complete", { agentA: "Alpha" }), NAMES)!;
    expect(actions).toHaveLength(1);
  });

  it("message.created maps to a chat naming the speaker", () => {
    const actions = translateArenaEvent(
      event("message.created", { content: "I disagree" }, "B"),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "chat", message: { role: "arena", agentId: "B", agentName: "GPT", content: "I disagree" } },
    ]);
  });

  it("finding.created captures the structured receipt before flattening to chat", () => {
    const actions = translateArenaEvent(
      event("finding.created", { severity: "blocker", claim: "Tests fail" }, "R"),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "receipt", receipt: { kind: "finding", severity: "blocker", claim: "Tests fail", agentName: "Reviewer" } },
      {
        kind: "chat",
        message: { role: "arena", agentId: "R", agentName: "Reviewer", content: "**blocker finding:** Tests fail" },
      },
    ]);
  });

  it("finding.created with no claim captures the receipt but skips the empty chat", () => {
    const actions = translateArenaEvent(
      event("finding.created", { severity: "minor", claim: "" }, "R"),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "receipt", receipt: { kind: "finding", severity: "minor", claim: "", agentName: "Reviewer" } },
    ]);
  });

  it("plan.approved / plan.rejected / dispute.opened / consensus.reached map to their receipts", () => {
    expect(kinds(translateArenaEvent(event("plan.approved"), NAMES))).toEqual(["receipt"]);
    expect(kinds(translateArenaEvent(event("plan.rejected"), NAMES))).toEqual(["receipt"]);
    expect(kinds(translateArenaEvent(event("dispute.opened"), NAMES))).toEqual(["receipt"]);
    expect(kinds(translateArenaEvent(event("consensus.reached"), NAMES))).toEqual(["receipt"]);
    expect(translateArenaEvent(event("plan.approved"), NAMES)).toEqual([
      { kind: "receipt", receipt: { kind: "plan-approved" } },
    ]);
    expect(translateArenaEvent(event("plan.rejected"), NAMES)).toEqual([
      { kind: "receipt", receipt: { kind: "plan-rejected" } },
    ]);
    expect(translateArenaEvent(event("dispute.opened"), NAMES)).toEqual([
      { kind: "receipt", receipt: { kind: "deadlock" } },
    ]);
    expect(translateArenaEvent(event("consensus.reached"), NAMES)).toEqual([
      { kind: "receipt", receipt: { kind: "consensus" } },
    ]);
  });

  it("round.started maps to a round receipt with both roles named", () => {
    const actions = translateArenaEvent(
      event("round.started", { round: 2, builder: "B", reviewer: "A" }),
      NAMES,
    )!;
    expect(actions).toEqual([
      { kind: "receipt", receipt: { kind: "round", number: 2, builder: "GPT", reviewer: "Claude" } },
    ]);
  });

  it("error maps to a judge chat", () => {
    const actions = translateArenaEvent(event("error", { error: "boom" }), NAMES)!;
    expect(actions).toEqual([
      { kind: "chat", message: { role: "judge", agentName: "Judge", content: "Arena session failed: boom" } },
    ]);
  });

  it("progress bookkeeping events are recognized but inert — no actions", () => {
    for (const kind of [
      "session.created",
      "session.initialized",
      "environment.checked",
      "analysis.started",
      "discussion.complete",
      "verification.completed",
      "review.started",
    ]) {
      expect(kinds(translateArenaEvent(event(kind), NAMES))).toEqual([]);
    }
  });

  it("an unknown event kind surfaces as unrecognized (null) — not silently dropped", () => {
    expect(translateArenaEvent(event("future.capability", {}), NAMES)).toBeNull();
    expect(translateArenaEvent(event(""), NAMES)).toBeNull();
  });
});
