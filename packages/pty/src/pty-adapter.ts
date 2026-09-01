import { AgentId } from "@arena/core";
import { OrchestratorAdapter, AgentResponse } from "@arena/core";
import { PersistentSession } from "./persistent-session.js";

export class PtyAgentAdapter implements OrchestratorAdapter {
  readonly id: AgentId;
  readonly name: string;
  private command: string;
  private args: string[];
  private sessions = new Map<string, PersistentSession>();

  constructor(
    id: AgentId,
    name: string,
    command: string,
    args: string[] = [],
  ) {
    this.id = id;
    this.name = name;
    this.command = command;
    this.args = args;
  }

  async start(config: {
    task: string;
    cwd: string;
  }): Promise<{ sessionId: string; pid: number }> {
    const session = new PersistentSession({
      command: this.command,
      args: this.args,
      cwd: config.cwd,
    });
    this.sessions.set(session.sessionId, session);
    return {
      sessionId: session.sessionId,
      pid: session.pid,
    };
  }

  async sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse> {
    const session = this.sessions.get(handle.sessionId);
    if (!session) {
      return { kind: "error", content: "Unknown session" };
    }
    if (!session.isAlive()) {
      return { kind: "crash", content: "Agent process exited" };
    }

    try {
      const response = await session.sendAndWait(message, 120_000);
      return { kind: "message", content: response.trim() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "timeout") {
        return {
          kind: "timeout",
          content: "Agent did not respond in time",
        };
      }
      return { kind: "error", content: msg };
    }
  }

  async terminate(handle: {
    sessionId: string;
  }): Promise<void> {
    const session = this.sessions.get(handle.sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(handle.sessionId);
    }
  }
}
