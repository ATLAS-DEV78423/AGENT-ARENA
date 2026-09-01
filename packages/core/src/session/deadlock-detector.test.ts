import { describe, it, expect, beforeEach } from "vitest";
import { DeadlockDetector } from "./deadlock-detector.js";
import { agentId } from "../types/common.js";

function objection(claim: string, agent = "a", round = 0) {
  return {
    agentId: agentId(agent),
    claim,
    evidence: "",
    timestamp: `2026-01-01T00:${String(round).padStart(2, "0")}:00Z` as any,
    round,
  };
}

describe("DeadlockDetector", () => {
  let dd: DeadlockDetector;

  beforeEach(() => {
    dd = new DeadlockDetector(2);
  });

  it("not deadlocked with no objections", () => {
    expect(dd.isDeadlock()).toBe(false);
  });

  it("not deadlocked with one objection", () => {
    dd.recordObjection(objection("Use X"));
    expect(dd.isDeadlock()).toBe(false);
  });

  it("detects deadlock when same claim repeated twice", () => {
    dd.recordObjection(objection("Use X", "a", 0));
    dd.recordObjection(objection("Use X", "a", 1));
    expect(dd.isDeadlock()).toBe(true);
  });

  it("normalizes claims case-insensitively", () => {
    dd.recordObjection(objection("Use Option X", "a", 0));
    dd.recordObjection(objection("use option x", "b", 1));
    expect(dd.isDeadlock()).toBe(true);
  });

  it("different claims are not deadlock", () => {
    dd.recordObjection(objection("Use X", "a", 0));
    dd.recordObjection(objection("Use Y", "b", 1));
    expect(dd.isDeadlock()).toBe(false);
  });

  it("respects configurable threshold", () => {
    const dd3 = new DeadlockDetector(3);
    dd3.recordObjection(objection("X", "a", 0));
    dd3.recordObjection(objection("X", "a", 1));
    expect(dd3.isDeadlock()).toBe(false);
    dd3.recordObjection(objection("X", "a", 2));
    expect(dd3.isDeadlock()).toBe(true);
  });

  it("returns all objections", () => {
    dd.recordObjection(objection("X", "a", 0));
    dd.recordObjection(objection("Y", "b", 1));
    expect(dd.getObjections()).toHaveLength(2);
  });

  it("reset clears history", () => {
    dd.recordObjection(objection("X", "a", 0));
    dd.recordObjection(objection("X", "a", 1));
    expect(dd.isDeadlock()).toBe(true);
    dd.reset();
    expect(dd.isDeadlock()).toBe(false);
  });
});
