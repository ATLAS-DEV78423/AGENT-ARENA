export interface BudgetLimits { maxRounds: number; maxMinutes: number; maxAgentTurns: number; maxToolCalls: number; }
export interface BudgetUsage { rounds: number; agentTurns: number; toolCalls: number; elapsedMs: number; }
export class BudgetEnforcer {
  private limits: BudgetLimits; private usage: BudgetUsage; private start: number;
  constructor(limits: BudgetLimits) { this.limits = limits; this.start = Date.now(); this.usage = { rounds: 0, agentTurns: 0, toolCalls: 0, elapsedMs: 0 }; }
  canProceed(): boolean { return !this.exceededReason; }
  get exceededReason(): string | null {
    this.usage.elapsedMs = Date.now() - this.start;
    if (this.usage.rounds >= this.limits.maxRounds) return "maxRounds exceeded";
    if (this.usage.elapsedMs >= this.limits.maxMinutes * 60000) return "maxMinutes exceeded";
    if (this.usage.agentTurns >= this.limits.maxAgentTurns) return "maxAgentTurns exceeded";
    if (this.usage.toolCalls >= this.limits.maxToolCalls) return "maxToolCalls exceeded";
    return null;
  }
  recordRound() { this.usage.rounds++; }
  recordAgentTurn() { this.usage.agentTurns++; }
  recordToolCall() { this.usage.toolCalls++; }
  getUsage(): BudgetUsage { this.usage.elapsedMs = Date.now() - this.start; return { ...this.usage }; }
}
