import { AgentId, SessionId, AgentStatus, AgentCapabilities } from "@arena/core";

export interface DetectionResult { detected: boolean; command: string; version?: string; path?: string; }
export interface AgentSessionHandle { sessionId: SessionId; pid: number; }
export interface AgentAdapter {
  id: AgentId; name: string;
  detect(): Promise<DetectionResult>;
  start(config: { task: string; cwd: string; env?: Record<string, string> }): Promise<AgentSessionHandle>;
  send(handle: AgentSessionHandle, message: string): Promise<void>;
  interrupt(handle: AgentSessionHandle): Promise<void>;
  terminate(handle: AgentSessionHandle): Promise<void>;
  getStatus(handle: AgentSessionHandle): Promise<AgentStatus>;
  capabilities(): Promise<AgentCapabilities>;
}
