import { describe, it, expect } from "vitest";
import { BudgetEnforcer } from "./budget.js";

describe("BudgetEnforcer", () => {
  it("tracks rounds", () => {
    const b = new BudgetEnforcer({ maxRounds: 2, maxMinutes: 10, maxAgentTurns: 20, maxToolCalls: 100 });
    expect(b.canProceed()).toBe(true);
    b.recordRound(); b.recordRound();
    expect(b.canProceed()).toBe(false);
  });
  it("reports exceeded reason", () => {
    const b = new BudgetEnforcer({ maxRounds: 1, maxMinutes: 10, maxAgentTurns: 20, maxToolCalls: 100 });
    b.recordRound();
    expect(b.exceededReason).toContain("maxRounds");
  });
  it("tracks tool calls", () => {
    const b = new BudgetEnforcer({ maxRounds: 5, maxMinutes: 10, maxAgentTurns: 40, maxToolCalls: 2 });
    b.recordToolCall(); b.recordToolCall();
    expect(b.canProceed()).toBe(false);
  });
});
