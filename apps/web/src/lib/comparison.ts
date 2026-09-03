import type { Message } from "./types";

export interface AgentColumn {
  agentId: string;
  agentName: string;
  messages: Message[];
}

/** Buckets arena messages by agent, preserving the order each agent spoke. */
export function comparisonColumns(messages: Message[]): AgentColumn[] {
  const columns = new Map<string, AgentColumn>();
  for (const m of messages) {
    if (m.role !== "arena" || !m.agentId) continue;
    const column = columns.get(m.agentId) ?? {
      agentId: m.agentId,
      agentName: m.agentName ?? m.agentId,
      messages: [],
    };
    column.messages.push(m);
    columns.set(m.agentId, column);
  }
  return [...columns.values()];
}

/** The final verdict, if any — the last judge message. */
export function verdictMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "judge") return messages[i];
  }
  return undefined;
}