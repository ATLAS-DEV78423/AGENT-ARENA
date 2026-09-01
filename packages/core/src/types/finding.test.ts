import { describe, it, expect } from "vitest";
import { createFinding, transitionFinding } from "./finding.js";
import { agentId } from "./common.js";

const baseParams = {
  severity: "major" as const,
  category: "general",
  claim: "Missing null check",
  evidence: "line 42",
  impact: "Runtime crash",
  fix: "Add guard",
  createdBy: agentId("reviewer"),
};

describe("Finding types", () => {
  it("creates a finding with OPEN state", () => {
    const f = createFinding(baseParams);
    expect(f.state).toBe("OPEN");
    expect(f.severity).toBe("major");
    expect(f.claim).toBe("Missing null check");
    expect(f.createdBy).toBe("reviewer");
    expect(f.id).toBeTruthy();
    expect(f.history).toHaveLength(0);
  });

  it("transitions OPEN → ACKNOWLEDGED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    expect(f.state).toBe("ACKNOWLEDGED");
    expect(f.history).toHaveLength(1);
    expect(f.history[0]?.from).toBe("OPEN");
    expect(f.history[0]?.to).toBe("ACKNOWLEDGED");
  });

  it("transitions through full lifecycle", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "accept");
    transitionFinding(f, "fix");
    transitionFinding(f, "verify");
    expect(f.state).toBe("VERIFIED");
    expect(f.history).toHaveLength(4);
  });

  it("transitions OPEN → REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "reject");
    expect(f.state).toBe("REJECTED");
  });

  it("transitions ACKNOWLEDGED → REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "reject");
    expect(f.state).toBe("REJECTED");
  });

  it("throws on invalid transition OPEN → fix", () => {
    const f = createFinding(baseParams);
    expect(() => transitionFinding(f, "fix")).toThrow(
      "Cannot transition finding from OPEN on event fix",
    );
  });

  it("throws on transition from terminal REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "reject");
    expect(() => transitionFinding(f, "acknowledge")).toThrow();
  });

  it("throws on transition from terminal VERIFIED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "accept");
    transitionFinding(f, "fix");
    transitionFinding(f, "verify");
    expect(() => transitionFinding(f, "acknowledge")).toThrow();
  });

  it("updates updatedAt on transition", () => {
    const f = createFinding(baseParams);
    const before = f.updatedAt;
    transitionFinding(f, "acknowledge");
    expect(f.updatedAt >= before).toBe(true);
  });
});
