import { SessionId, AgentId, RoundNumber, Timestamp, now } from "./common.js";
import { ArenaState } from "./state-machine.js";
import { ProtocolEvent } from "./protocol.js";

export type Role = "Builder" | "Reviewer";

export interface AgentRoleAssignment {
  agentId: AgentId;
  role: Role;
}

export interface Round {
  number: RoundNumber;
  builder: AgentId;
  reviewer: AgentId;
  startedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface ArenaSession {
  id: SessionId;
  task: string;
  agentA: AgentId;
  agentB: AgentId;
  state: ArenaState;
  rounds: Round[];
  currentRound: RoundNumber;
  events: ProtocolEvent[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function createSession(params: { id: SessionId; task: string; agentA: AgentId; agentB: AgentId }): ArenaSession {
  return { ...params, state: "CREATED", rounds: [], currentRound: 0 as RoundNumber, events: [], createdAt: now(), updatedAt: now() };
}

export function assignRoles(agentA: AgentId, agentB: AgentId): [AgentRoleAssignment, AgentRoleAssignment] {
  const firstIsBuilder = Math.random() < 0.5;
  return firstIsBuilder
    ? [{ agentId: agentA, role: "Builder" }, { agentId: agentB, role: "Reviewer" }]
    : [{ agentId: agentA, role: "Reviewer" }, { agentId: agentB, role: "Builder" }];
}

export function switchRoles(currentRound: Round): Round {
  return { number: (currentRound.number + 1) as RoundNumber, builder: currentRound.reviewer, reviewer: currentRound.builder, startedAt: now() };
}
