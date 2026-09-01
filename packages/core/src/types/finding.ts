import { FindingId, AgentId, Timestamp, findingId, now } from "./common.js";
import { randomUUID } from "node:crypto";

export const FINDING_STATES = [
  "OPEN",
  "ACKNOWLEDGED",
  "ACCEPTED",
  "REJECTED",
  "FIXED",
  "VERIFIED",
] as const;

export type FindingState = (typeof FINDING_STATES)[number];

export type FindingEvent =
  | "acknowledge"
  | "accept"
  | "reject"
  | "fix"
  | "verify";

export const FINDING_TRANSITIONS: Record<
  FindingState,
  Partial<Record<FindingEvent, FindingState>>
> = {
  OPEN: { acknowledge: "ACKNOWLEDGED", reject: "REJECTED" },
  ACKNOWLEDGED: { accept: "ACCEPTED", reject: "REJECTED" },
  ACCEPTED: { fix: "FIXED" },
  REJECTED: {},
  FIXED: { verify: "VERIFIED" },
  VERIFIED: {},
};

export const FINDING_SEVERITIES = [
  "blocker",
  "major",
  "minor",
  "note",
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface FindingTransition {
  from: FindingState;
  to: FindingState;
  event: FindingEvent;
  timestamp: Timestamp;
}

export interface Finding {
  id: FindingId;
  severity: FindingSeverity;
  category: string;
  claim: string;
  evidence: string;
  impact: string;
  fix: string;
  state: FindingState;
  createdBy: AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  history: FindingTransition[];
}

export interface CreateFindingParams {
  severity: FindingSeverity;
  category: string;
  claim: string;
  evidence: string;
  impact: string;
  fix: string;
  createdBy: AgentId;
}

export function createFinding(params: CreateFindingParams): Finding {
  const ts = now();
  return {
    id: findingId(randomUUID()),
    ...params,
    state: "OPEN",
    createdAt: ts,
    updatedAt: ts,
    history: [],
  };
}

export function transitionFinding(
  finding: Finding,
  event: FindingEvent,
): void {
  const target = FINDING_TRANSITIONS[finding.state]?.[event];
  if (!target) {
    throw new Error(
      `Cannot transition finding from ${finding.state} on event ${event}`,
    );
  }
  const ts = now();
  finding.history.push({
    from: finding.state,
    to: target,
    event,
    timestamp: ts,
  });
  finding.state = target;
  finding.updatedAt = ts;
}
