/**
 * Pure translation of orchestrator events into the outbound actions the UI
 * consumes (phase updates, chat messages, verdict receipts).
 *
 * Exhaustive by construction: every event kind the orchestrator can emit is a
 * key in `HANDLERS` (TypeScript errors if one is missing), and each is either
 * handled explicitly or declared inert. Anything outside that vocabulary —
 * a future orchestrator event — returns `null` so the caller surfaces it
 * (console.warn) instead of silently dropping it.
 */
import type { OrchestratorEvent } from "@arena/core";
import type { Receipt } from "@/lib/types";

/** A chat line shown in the transcript. */
export interface ArenaChatMessage {
  role: "arena" | "judge";
  agentId?: string;
  agentName?: string;
  content: string;
}

/** One agent-turn progress update: which agent is working, in which phase. */
export interface ArenaPhase {
  phase: string;
  agentId?: string;
  agentName?: string;
}

/**
 * The event kinds `@arena/core` can emit (its `OrchestratorEvent.type` is an
 * open string; this is the closed set of emit sites the runtime must answer).
 * Adding an emit site upstream without a case here fails the typecheck.
 */
type ArenaEventKind =
  | "session.created"
  | "session.initialized"
  | "environment.checked"
  | "analysis.started"
  | "analysis.complete"
  | "message.created"
  | "discussion.complete"
  | "dispute.opened"
  | "plan.rejected"
  | "plan.approved"
  | "round.started"
  | "verification.completed"
  | "finding.created"
  | "review.started"
  | "consensus.reached"
  | "agent.thinking"
  | "error";

/** One outbound effect produced by an event. */
export type ArenaEventAction =
  | { kind: "phase"; phase: ArenaPhase }
  | { kind: "chat"; message: ArenaChatMessage }
  | { kind: "receipt"; receipt: Receipt };

/** Agent-name lookups the mapping needs (bound to the live roster in runArena). */
export interface ArenaEventNames {
  /** Display name for an agent id (the roster/adapter map). */
  resolveName: (id: string) => string | undefined;
  /** Positional pair — `analysis.complete` carries answers without ids. */
  agentA: { id: string; name: string };
  agentB: { id: string; name: string };
}

function chat(message: ArenaChatMessage): ArenaEventAction {
  return { kind: "chat", message };
}

function receipt(receipt: Receipt): ArenaEventAction {
  return { kind: "receipt", receipt };
}

const HANDLERS: Record<ArenaEventKind, (event: OrchestratorEvent, names: ArenaEventNames) => ArenaEventAction[]> = {
  "agent.thinking": (event, names) => [
    {
      kind: "phase",
      phase: {
        phase: String(event.data?.phase ?? ""),
        agentId: event.agentId as string | undefined,
        agentName: event.agentId ? names.resolveName(event.agentId as string) : undefined,
      },
    },
  ],
  "analysis.complete": (event, names) => {
    const actions: ArenaEventAction[] = [];
    if (event.data?.agentA) actions.push(chat({ role: "arena", agentId: names.agentA.id, agentName: names.agentA.name, content: String(event.data.agentA) }));
    if (event.data?.agentB) actions.push(chat({ role: "arena", agentId: names.agentB.id, agentName: names.agentB.name, content: String(event.data.agentB) }));
    return actions;
  },
  "message.created": (event, names) =>
    event.data?.content
      ? [chat({
          role: "arena",
          agentId: event.agentId as string | undefined,
          agentName: event.agentId ? names.resolveName(event.agentId as string) : undefined,
          content: String(event.data.content),
        })]
      : [],
  "finding.created": (event, names) => {
    const severity = String(event.data?.severity ?? "finding");
    const claim = String(event.data?.claim ?? "");
    const agentName = event.agentId ? names.resolveName(event.agentId as string) : undefined;
    // Capture the structured fact first — the chat copy below flattens it.
    const actions: ArenaEventAction[] = [receipt({ kind: "finding", severity, claim, agentName })];
    if (claim) {
      actions.push(chat({
        role: "arena",
        agentId: event.agentId as string | undefined,
        agentName,
        content: `**${severity} finding:** ${claim}`,
      }));
    }
    return actions;
  },
  "plan.approved": () => [receipt({ kind: "plan-approved" })],
  "plan.rejected": (event, names) => {
    const data = event.data as { agentId?: unknown; noResponse?: unknown } | undefined;
    const silent = data?.noResponse === true && typeof data.agentId === "string";
    return [
      receipt({
        kind: "plan-rejected",
        ...(silent
          ? { noResponse: true, agentName: names.resolveName(data.agentId as string) }
          : {}),
      }),
    ];
  },
  "dispute.opened": () => [receipt({ kind: "deadlock" })],
  "round.started": (event, names) => [
    receipt({
      kind: "round",
      number: Number(event.data?.round ?? 1),
      builder: event.data?.builder
        ? names.resolveName(String(event.data.builder)) ?? String(event.data.builder)
        : "",
      reviewer: event.data?.reviewer
        ? names.resolveName(String(event.data.reviewer)) ?? String(event.data.reviewer)
        : "",
    }),
  ],
  "consensus.reached": () => [receipt({ kind: "consensus" })],
  error: (event) => [
    chat({
      role: "judge",
      agentName: "Judge",
      content: `Arena session failed: ${String(event.data?.error ?? "unknown error")}`,
    }),
  ],
  // Progress bookkeeping events the UI deliberately doesn't render or capture.
  "session.created": () => [],
  "session.initialized": () => [],
  "environment.checked": () => [],
  "analysis.started": () => [],
  "discussion.complete": () => [],
  "verification.completed": () => [],
  "review.started": () => [],
};

/**
 * Maps one orchestrator event to its outbound actions, or `null` when the
 * event kind is outside the known vocabulary. `null` is the caller's cue to
 * log the unknown event — never swallow it.
 */
export function translateArenaEvent(
  event: OrchestratorEvent,
  names: ArenaEventNames,
): ArenaEventAction[] | null {
  return HANDLERS[event.type as ArenaEventKind]?.(event, names) ?? null;
}

/**
 * The terminal judge sentence for a no-consensus run. A run ends on rejection
 * (the orchestrator returns), so at most one plan.rejected can appear.
 */
export function noConsensusMessage(
  events: ReadonlyArray<{ type: string; data?: Record<string, unknown> }>,
  resolveName: (id: string) => string | undefined,
): string {
  if (events.some((e) => e.type === "dispute.opened")) {
    return "The arena session ended in deadlock — repeated objections without resolution.";
  }
  const vote = events.find((e) => e.type === "plan.rejected");
  if (!vote) {
    return "The arena session ended without consensus — the agents could not agree within the round/time budget.";
  }
  const payload = vote.data;
  const silent =
    payload?.noResponse === true && typeof payload.agentId === "string"
      ? resolveName(payload.agentId)
      : undefined;
  return silent
    ? `The arena session ended without consensus — ${silent} did not respond in time.`
    : "The arena session ended without consensus — the proposed plan was rejected.";
}
