export interface Agent {
  id: string;
  name: string;
  provider: string;
  status: "online" | "offline" | "thinking";
  model?: string;
  /** True when this agent runs a real model on the server. */
  live?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "arena" | "judge";
  agentId?: string;
  agentName?: string;
  content: string;
  timestamp: Date;
}

export type SessionStatus = "running" | "completed" | "error" | "interrupted";

/**
 * Live progress for a running arena: the orchestrator announces which agent is
 * working in which phase (agent.thinking) just before every agent turn.
 * `since` is the epoch ms the phase became current.
 */
export interface SessionPhase {
  key: string;
  agentId?: string;
  agentName?: string;
  since: number;
}

/**
 * A structured fact captured from an orchestrator event, so the verdict can
 * cite what actually happened instead of only its one-line outcome.
 */
export type Receipt =
  | { kind: "plan-approved" }
  | { kind: "plan-rejected" }
  | { kind: "deadlock" }
  | { kind: "round"; number: number; builder: string; reviewer: string }
  | { kind: "finding"; severity: string; claim: string; agentName?: string }
  | { kind: "consensus" };

export interface Session {
  id: string;
  title: string;
  type: "arena";
  agents: string[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  status: SessionStatus;
  /** Set once the backend announces how the session ran. */
  mode?: "live" | "demo";
  /** Present only while the run is streaming progress events. */
  phase?: SessionPhase;
  /** Structured facts for the verdict card; absent on older sessions. */
  receipts?: Receipt[];
}
