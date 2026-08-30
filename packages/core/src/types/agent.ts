import { AgentId, Timestamp, now } from "./common.js";

export interface AgentCapabilities {
  terminal: boolean;
  filesystem: boolean;
  shell: boolean;
  mcp: boolean;
  plugins: boolean;
  network: boolean;
  interactive: boolean;
  supportsInterrupt: boolean;
  supportsResume: boolean;
}

export type AgentStatus = "idle" | "starting" | "running" | "waiting" | "stopped" | "crashed";

export interface AgentProfile {
  id: AgentId;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  capabilities: AgentCapabilities;
  detectedAt?: Timestamp;
}

export function createAgentProfile(params: Omit<AgentProfile, "detectedAt">): AgentProfile {
  return { ...params, detectedAt: now() };
}
