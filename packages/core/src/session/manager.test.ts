import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "./manager.js";
import { agentId } from "../types/common.js";

describe("SessionManager", () => {
  let m: SessionManager;
  beforeEach(() => { m = new SessionManager(); });
  it("creates session", async () => {
    const s = await m.createSession({ task: "Build X", agentA: agentId("a"), agentB: agentId("b") });
    expect(s.state).toBe("CREATED");
    expect(s.task).toBe("Build X");
  });
  it("transitions state", async () => {
    const s = await m.createSession({ task: "X", agentA: agentId("a"), agentB: agentId("b") });
    m.transition(s.id, "initialize");
    expect(m.getState(s.id)).toBe("INITIALIZING");
  });
  it("rejects invalid transition", async () => {
    const s = await m.createSession({ task: "X", agentA: agentId("a"), agentB: agentId("b") });
    expect(() => m.transition(s.id, "consensus_reached")).toThrow();
  });
  it("assigns roles", async () => {
    const s = await m.createSession({ task: "X", agentA: agentId("a"), agentB: agentId("b") });
    const roles = m.getRoles(s.id);
    expect(roles.map(r => r.role)).toContain("Builder");
    expect(roles.map(r => r.role)).toContain("Reviewer");
  });
});
