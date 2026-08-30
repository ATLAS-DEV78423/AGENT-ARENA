import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getAllowedEvents,
  TERMINAL_STATES,
  ARENA_STATES,
} from "./state-machine.js";

describe("Arena state definitions", () => {
  it("defines all required primary states", () => {
    const required = [
      "CREATED", "INITIALIZING", "ENVIRONMENT_CHECK",
      "ANALYZING", "DISCUSSING", "PLANNING",
      "AWAITING_PLAN_APPROVAL", "IMPLEMENTING", "REVIEWING",
      "REVISING", "VERIFYING", "ROLE_SWITCH",
      "FINAL_REVIEW", "CONSENSUS", "COMPLETED",
    ];
    for (const s of required) expect(ARENA_STATES).toContain(s);
  });

  it("defines operational states", () => {
    const ops = ["PAUSED", "CANCELLED", "INTERRUPTED", "RECOVERING", "FAILED", "USER_DECISION_REQUIRED"];
    for (const s of ops) expect(ARENA_STATES).toContain(s);
  });
});

describe("valid transitions", () => {
  it("CREATED → INITIALIZING", () => {
    expect(isValidTransition("CREATED", "initialize")).toBe(true);
  });

  it("INITIALIZING → ENVIRONMENT_CHECK", () => {
    expect(isValidTransition("INITIALIZING", "environment_checked")).toBe(true);
  });

  it("ANALYZING → DISCUSSING", () => {
    expect(isValidTransition("ANALYZING", "analysis_complete")).toBe(true);
  });

  it("PLANNING → AWAITING_PLAN_APPROVAL", () => {
    expect(isValidTransition("PLANNING", "plan_submitted")).toBe(true);
  });

  it("AWAITING_PLAN_APPROVAL → IMPLEMENTING on approve", () => {
    expect(isValidTransition("AWAITING_PLAN_APPROVAL", "plan_approved")).toBe(true);
  });

  it("AWAITING_PLAN_APPROVAL → PLANNING on reject", () => {
    expect(isValidTransition("AWAITING_PLAN_APPROVAL", "plan_rejected")).toBe(true);
  });

  it("IMPLEMENTING → REVIEWING", () => {
    expect(isValidTransition("IMPLEMENTING", "implementation_completed")).toBe(true);
  });

  it("REVIEWING → REVISING", () => {
    expect(isValidTransition("REVIEWING", "findings_presented")).toBe(true);
  });

  it("REVIEWING → VERIFYING", () => {
    expect(isValidTransition("REVIEWING", "review_completed")).toBe(true);
  });

  it("VERIFYING → ROLE_SWITCH", () => {
    expect(isValidTransition("VERIFYING", "verification_passed")).toBe(true);
  });

  it("FINAL_REVIEW → COMPLETED", () => {
    expect(isValidTransition("FINAL_REVIEW", "final_review_passed")).toBe(true);
  });
});

describe("any state → PAUSED", () => {
  it.each(["CREATED", "ANALYZING", "DISCUSSING", "PLANNING", "IMPLEMENTING", "REVIEWING"])(
    "%s → PAUSED",
    (state) => {
      expect(isValidTransition(state as any, "pause")).toBe(true);
    },
  );
});

describe("terminal states", () => {
  it("COMPLETED has no outgoing transitions", () => {
    expect(isValidTransition("COMPLETED", "anything")).toBe(false);
  });

  it("CANCELLED has no outgoing transitions", () => {
    expect(isValidTransition("CANCELLED", "resume")).toBe(false);
  });

  it("FAILED has no outgoing transitions", () => {
    expect(isValidTransition("FAILED", "initialize")).toBe(false);
  });
});

describe("invalid transitions", () => {
  it("rejects CREATED → COMPLETED (skipping states)", () => {
    expect(isValidTransition("CREATED", "consensus_reached")).toBe(false);
  });

  it("rejects IMPLEMENTING → IMPLEMENTING (self-loop)", () => {
    expect(isValidTransition("IMPLEMENTING", "implementation_started")).toBe(false);
  });
});

describe("getAllowedEvents", () => {
  it("returns allowed events for CREATED", () => {
    const events = getAllowedEvents("CREATED");
    expect(events).toContain("initialize");
  });

  it("returns empty for COMPLETED", () => {
    expect(getAllowedEvents("COMPLETED")).toHaveLength(0);
  });
});
