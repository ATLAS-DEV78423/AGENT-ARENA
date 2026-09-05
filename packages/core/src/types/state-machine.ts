export const ARENA_STATES = [
  "CREATED", "INITIALIZING", "ENVIRONMENT_CHECK",
  "ANALYZING", "DISCUSSING", "PLANNING",
  "AWAITING_PLAN_APPROVAL", "IMPLEMENTING", "REVIEWING",
  "REVISING", "VERIFYING", "ROLE_SWITCH",
  "FINAL_REVIEW", "CONSENSUS", "COMPLETED",
  "PAUSED", "CANCELLED", "INTERRUPTED",
  "RECOVERING", "FAILED", "USER_DECISION_REQUIRED",
] as const;

export type ArenaState = (typeof ARENA_STATES)[number];

export type ArenaEvent =
  | "initialize"
  | "environment_checked"
  | "analysis_complete"
  | "discussion_complete"
  | "plan_submitted"
  | "plan_approved"
  | "plan_rejected"
  | "implementation_started"
  | "implementation_completed"
  | "review_started"
  | "review_completed"
  | "findings_presented"
  | "findings_resolved"
  | "revision_needed"
  | "verification_passed"
  | "verification_failed"
  | "role_switched"
  | "final_review_passed"
  | "final_review_failed"
  | "consensus_reached"
  | "escalate_to_user"
  | "user_decision_received"
  | "pause"
  | "resume"
  | "cancel"
  | "recover"
  | "agent_crashed"
  | "agent_recovered"
  | "timeout";

export const TRANSITION_TABLE: Record<ArenaState, Partial<Record<ArenaEvent, ArenaState>>> = {
  CREATED:                    { initialize: "INITIALIZING", cancel: "CANCELLED", pause: "PAUSED" },
  INITIALIZING:               { environment_checked: "ENVIRONMENT_CHECK", cancel: "CANCELLED", pause: "PAUSED", timeout: "FAILED", agent_crashed: "FAILED" },
  ENVIRONMENT_CHECK:          { analysis_complete: "ANALYZING", cancel: "CANCELLED", pause: "PAUSED", agent_crashed: "FAILED" },
  ANALYZING:                  { analysis_complete: "DISCUSSING", cancel: "CANCELLED", pause: "PAUSED", agent_crashed: "FAILED", timeout: "FAILED" },
  DISCUSSING:                 { discussion_complete: "PLANNING", escalate_to_user: "USER_DECISION_REQUIRED", cancel: "CANCELLED", pause: "PAUSED", timeout: "FAILED", agent_crashed: "RECOVERING" },
  PLANNING:                   { plan_submitted: "AWAITING_PLAN_APPROVAL", cancel: "CANCELLED", pause: "PAUSED", timeout: "FAILED" },
  AWAITING_PLAN_APPROVAL:     { plan_approved: "IMPLEMENTING", plan_rejected: "PLANNING", cancel: "CANCELLED", pause: "PAUSED", timeout: "USER_DECISION_REQUIRED" },
  IMPLEMENTING:               { implementation_completed: "REVIEWING", cancel: "CANCELLED", pause: "PAUSED", agent_crashed: "RECOVERING", timeout: "FAILED" },
  REVIEWING:                  { review_completed: "VERIFYING", findings_presented: "REVISING", cancel: "CANCELLED", pause: "PAUSED", agent_crashed: "RECOVERING", timeout: "FAILED" },
  REVISING:                   { findings_resolved: "VERIFYING", review_completed: "VERIFYING", escalate_to_user: "USER_DECISION_REQUIRED", cancel: "CANCELLED", pause: "PAUSED", timeout: "FAILED" },
  VERIFYING:                  { verification_passed: "ROLE_SWITCH", verification_failed: "REVISING", cancel: "CANCELLED", pause: "PAUSED", timeout: "FAILED" },
  ROLE_SWITCH:                { implementation_started: "IMPLEMENTING", final_review_passed: "FINAL_REVIEW", timeout: "FAILED", cancel: "CANCELLED", pause: "PAUSED" },
  FINAL_REVIEW:               { final_review_passed: "COMPLETED", final_review_failed: "REVISING", consensus_reached: "COMPLETED", escalate_to_user: "USER_DECISION_REQUIRED", cancel: "CANCELLED" },
  CONSENSUS:                  {},
  COMPLETED:                  {},
  PAUSED:                     { resume: "ANALYZING", cancel: "CANCELLED" },
  CANCELLED:                  {},
  INTERRUPTED:                { recover: "RECOVERING", cancel: "CANCELLED" },
  RECOVERING:                 { agent_recovered: "ANALYZING", agent_crashed: "FAILED", timeout: "FAILED", cancel: "CANCELLED" },
  FAILED:                     {},
  USER_DECISION_REQUIRED:     { user_decision_received: "ANALYZING", cancel: "CANCELLED" },
};

export const TERMINAL_STATES: readonly ArenaState[] = [
  "COMPLETED", "CONSENSUS", "CANCELLED", "FAILED",
];

export function isValidTransition(from: ArenaState, event: ArenaEvent): boolean {
  const transitions = TRANSITION_TABLE[from];
  if (!transitions) return false;
  return event in transitions;
}

export function getAllowedEvents(state: ArenaState): ArenaEvent[] {
  const transitions = TRANSITION_TABLE[state];
  if (!transitions) return [];
  return Object.keys(transitions) as ArenaEvent[];
}
