import { describe, it, expect } from "vitest";
import { assignRoles, switchRoles, createSession } from "./session.js";
import { sessionId, agentId, roundNumber } from "./common.js";

describe("assignRoles", () => {
  it("assigns Builder and Reviewer to different agents", () => {
    const [a, b] = assignRoles(agentId("claude"), agentId("codex"));
    expect(a.agentId).not.toBe(b.agentId);
    expect([a.role, b.role]).toContain("Builder");
    expect([a.role, b.role]).toContain("Reviewer");
  });

  it("randomizes assignment across runs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const [a] = assignRoles(agentId("a"), agentId("b"));
      seen.add(a.role);
    }
    expect(seen.size).toBe(2);
  });
});

describe("switchRoles", () => {
  it("swaps builder and reviewer, increments round", () => {
    const r = { number: roundNumber(1), builder: agentId("a"), reviewer: agentId("b"), startedAt: new Date().toISOString() };
    const s = switchRoles(r);
    expect(s.builder).toBe("b");
    expect(s.reviewer).toBe("a");
    expect(s.number).toBe(2);
  });
});

describe("createSession", () => {
  it("creates session with CREATED state", () => {
    const s = createSession({ id: sessionId("s1"), task: "Build X", agentA: agentId("a"), agentB: agentId("b") });
    expect(s.state).toBe("CREATED");
    expect(s.task).toBe("Build X");
  });
});
