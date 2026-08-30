import { randomUUID } from "node:crypto";
import { SessionId, AgentId, sessionId } from "../types/common.js";
import { ArenaState } from "../types/state-machine.js";
import { ArenaSession, AgentRoleAssignment, createSession, assignRoles } from "../types/session.js";
import { ArenaStateMachine } from "../state-machine.js";
import { BudgetEnforcer, BudgetLimits } from "./budget.js";

const DEFAULT_BUDGET: BudgetLimits = { maxRounds: 5, maxMinutes: 20, maxAgentTurns: 40, maxToolCalls: 200 };

interface Managed { session: ArenaSession; sm: ArenaStateMachine; budget: BudgetEnforcer; roles: [AgentRoleAssignment, AgentRoleAssignment]; }

export class SessionManager {
  private sessions = new Map<string, Managed>();
  async createSession(params: { task: string; agentA: AgentId; agentB: AgentId; budget?: Partial<BudgetLimits> }) {
    const id = sessionId(randomUUID());
    const session = createSession({ id, ...params });
    const managed: Managed = { session, sm: new ArenaStateMachine("CREATED"), budget: new BudgetEnforcer({ ...DEFAULT_BUDGET, ...params.budget }), roles: assignRoles(params.agentA, params.agentB) };
    this.sessions.set(id, managed);
    return session;
  }
  getState(id: SessionId): ArenaState { return this.get(id).sm.state; }
  transition(id: SessionId, event: string) { const m = this.get(id); m.sm.transition(event as any); m.session.state = m.sm.state; m.session.updatedAt = new Date().toISOString() as any; }
  getRoles(id: SessionId) { return this.get(id).roles; }
  getBudget(id: SessionId) { return this.get(id).budget; }
  getSession(id: SessionId) { return this.get(id).session; }
  private get(id: SessionId): Managed { const m = this.sessions.get(id); if (!m) throw new Error("Session " + id + " not found"); return m; }
}
