import { AgentId, SessionId } from "./types/common.js";
import { ArenaState } from "./types/state-machine.js";

export type AgentResponseType =
  | { kind: "analysis"; understanding: string; assumptions: string[]; risks: string[]; approaches: string[]; confidence: number }
  | { kind: "message"; messageType: string; content: string }
  | { kind: "plan_approved"; notes: string }
  | { kind: "plan_rejected"; reason: string }
  | { kind: "finding"; severity: string; category: string; claim: string; evidence: string; impact: string; fix: string }
  | { kind: "review_approved"; notes: string }
  | { kind: "review_rejected"; findings: string[] }
  | { kind: "final_approved"; notes: string }
  | { kind: "final_rejected"; reason: string }
  | { kind: "error"; message: string }
  | { kind: "timeout" }
  | { kind: "crash" };

export interface OrchestratorConfig {
  task: string;
  cwd: string;
  maxRounds?: number;
  maxMinutes?: number;
}

export interface OrchestratorEvent {
  type: string;
  state: ArenaState;
  agentId?: AgentId;
  data?: Record<string, unknown>;
  timestamp: string;
}
