import { describe, it, expect, beforeEach } from "vitest";
import { ArenaStateMachine } from "./state-machine.js";
import { ArenaError, ErrorCode } from "./errors/arena-error.js";

describe("ArenaStateMachine", () => {
  let sm: ArenaStateMachine;
  beforeEach(() => { sm = new ArenaStateMachine("CREATED"); });

  it("starts in CREATED", () => { expect(sm.state).toBe("CREATED"); });

  it("transitions on valid event", () => {
    sm.transition("initialize");
    expect(sm.state).toBe("INITIALIZING"); });

  it("throws ArenaError on invalid transition", () => {
    expect(() => sm.transition("consensus_reached")).toThrow(ArenaError); });

  it("records transition history", () => {
    sm.transition("initialize");
    sm.transition("environment_checked");
    expect(sm.history).toHaveLength(2);
    expect(sm.history[0]?.from).toBe("CREATED");
    expect(sm.history[0]?.to).toBe("INITIALIZING"); });

  it("prevents transitions from terminal states", () => {
    sm.transition("initialize");
    sm.transition("cancel");
    expect(sm.state).toBe("CANCELLED");
    expect(() => sm.transition("resume")).toThrow();
    expect(sm.state).toBe("CANCELLED"); });

  it("reports isTerminal correctly", () => {
    expect(sm.isTerminal).toBe(false);
    sm.transition("initialize");
    sm.transition("cancel");
    expect(sm.isTerminal).toBe(true); });

  it("handles multiple rapid transitions", () => {
    for (const e of ["initialize", "environment_checked", "analysis_complete", "analysis_complete", "discussion_complete"]) {
      sm.transition(e as any);
    }
    expect(sm.state).toBe("PLANNING");
    expect(sm.history).toHaveLength(5); });

  it("includes valid error info on invalid transition", () => {
    try { sm.transition("plan_approved" as any); }
    catch (e) {
      expect(e).toBeInstanceOf(ArenaError);
      expect((e as ArenaError).code).toBe(ErrorCode.PROTOCOL_TRANSITION_INVALID);
    }
  });
});
