import { AgentId, Timestamp } from "../types/common.js";

export interface Objection {
  agentId: AgentId;
  claim: string;
  evidence: string;
  timestamp: Timestamp;
  round: number;
}

export class DeadlockDetector {
  private maxRepeated: number;
  private history: Objection[] = [];

  constructor(maxRepeated: number = 2) {
    this.maxRepeated = maxRepeated;
  }

  recordObjection(objection: Objection): void {
    this.history.push(objection);
  }

  isDeadlock(): boolean {
    const counts = new Map<string, number>();
    for (const obj of this.history) {
      const key = obj.claim.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      if (count >= this.maxRepeated) return true;
    }
    return false;
  }

  getObjections(): readonly Objection[] {
    return this.history;
  }

  reset(): void {
    this.history = [];
  }
}
