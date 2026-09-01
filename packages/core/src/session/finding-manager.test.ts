import { describe, it, expect, beforeEach } from "vitest";
import { FindingManager } from "./finding-manager.js";
import { agentId } from "../types/common.js";

const baseParams = {
  severity: "major" as const,
  category: "general",
  claim: "Bug found",
  evidence: "test output",
  impact: "CI fails",
  fix: "Fix the bug",
  createdBy: agentId("reviewer"),
};

describe("FindingManager", () => {
  let fm: FindingManager;

  beforeEach(() => {
    fm = new FindingManager();
  });

  it("creates and retrieves a finding", () => {
    const f = fm.create(baseParams);
    expect(f.state).toBe("OPEN");
    expect(fm.get(f.id)).toBe(f);
  });

  it("lists all findings", () => {
    fm.create(baseParams);
    fm.create({ ...baseParams, claim: "Second bug" });
    expect(fm.getAll()).toHaveLength(2);
  });

  it("transitions a finding", () => {
    const f = fm.create(baseParams);
    fm.transition(f.id, "acknowledge");
    expect(fm.get(f.id).state).toBe("ACKNOWLEDGED");
  });

  it("filters by state", () => {
    const f1 = fm.create(baseParams);
    fm.create({ ...baseParams, claim: "Second" });
    fm.transition(f1.id, "acknowledge");
    expect(fm.getByState("OPEN")).toHaveLength(1);
    expect(fm.getByState("ACKNOWLEDGED")).toHaveLength(1);
  });

  it("filters by severity", () => {
    fm.create({ ...baseParams, severity: "blocker" });
    fm.create({ ...baseParams, severity: "minor" });
    expect(fm.getBySeverity("blocker")).toHaveLength(1);
    expect(fm.getBySeverity("minor")).toHaveLength(1);
  });

  it("hasBlocking is true when open blocker exists", () => {
    fm.create({ ...baseParams, severity: "blocker" });
    expect(fm.hasBlocking()).toBe(true);
  });

  it("hasBlocking is false when all blockers are verified", () => {
    const f = fm.create({ ...baseParams, severity: "blocker" });
    fm.transition(f.id, "acknowledge");
    fm.transition(f.id, "accept");
    fm.transition(f.id, "fix");
    fm.transition(f.id, "verify");
    expect(fm.hasBlocking()).toBe(false);
  });

  it("rejected findings are not blocking", () => {
    const f = fm.create({ ...baseParams, severity: "blocker" });
    fm.transition(f.id, "reject");
    expect(fm.hasBlocking()).toBe(false);
  });

  it("getAcceptedUnfixed returns only ACCEPTED findings", () => {
    const f1 = fm.create(baseParams);
    const f2 = fm.create({ ...baseParams, claim: "Second" });
    fm.transition(f1.id, "acknowledge");
    fm.transition(f1.id, "accept");
    fm.transition(f2.id, "acknowledge");
    expect(fm.getAcceptedUnfixed()).toHaveLength(1);
    expect(fm.getAcceptedUnfixed()[0]?.id).toBe(f1.id);
  });

  it("throws on transition of unknown finding", () => {
    expect(() =>
      fm.transition(agentId("nonexistent") as any, "acknowledge"),
    ).toThrow("not found");
  });
});
