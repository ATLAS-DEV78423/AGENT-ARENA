import { SessionId, AgentId, Timestamp, now } from "./common.js";
import { randomUUID } from "node:crypto";

export const EVENT_TYPES = [
  "session.created", "agent.started", "agent.ready",
  "analysis.submitted", "discussion.started", "message.created",
  "question.created", "question.answered",
  "plan.proposed", "plan.modified", "plan.approved",
  "implementation.started", "implementation.completed",
  "review.started", "finding.created", "finding.accepted",
  "finding.rejected", "finding.resolved",
  "verification.started", "verification.completed",
  "role.switched", "approval.requested", "approval.granted",
  "approval.revoked", "dispute.opened", "user.input_required",
  "session.paused", "session.resumed", "session.failed",
  "session.completed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface ProtocolEvent {
  id: string;
  type: EventType;
  sessionId: SessionId;
  agentId: AgentId;
  timestamp: Timestamp;
  data: Record<string, unknown>;
}

function baseEvent(type: EventType, sessionId: SessionId, agentId: AgentId, data: Record<string, unknown>): ProtocolEvent {
  return { id: randomUUID(), type, sessionId, agentId, timestamp: now(), data };
}

export function createAnalysisEvent(params: { sessionId: SessionId; agentId: AgentId; data: Record<string, unknown> }): ProtocolEvent {
  return baseEvent("analysis.submitted", params.sessionId, params.agentId, params.data);
}

export function createDiscussionMessage(params: { sessionId: SessionId; agentId: AgentId; data: Record<string, unknown> }): ProtocolEvent {
  return baseEvent("message.created", params.sessionId, params.agentId, params.data);
}

export function createFinding(params: { sessionId: SessionId; agentId: AgentId; data: Record<string, unknown> }): ProtocolEvent {
  return baseEvent("finding.created", params.sessionId, params.agentId, { ...params.data, status: "OPEN" });
}

export function createApproval(params: { sessionId: SessionId; agentId: AgentId; data: Record<string, unknown> }): ProtocolEvent {
  const type = params.data.status === "approved" ? "plan.approved" : "approval.revoked";
  return baseEvent(type as EventType, params.sessionId, params.agentId, params.data);
}

export function createPlan(params: { sessionId: SessionId; agentId?: AgentId; data: Record<string, unknown> }): ProtocolEvent {
  return baseEvent("plan.proposed", params.sessionId, params.agentId ?? ("system" as AgentId), params.data);
}
