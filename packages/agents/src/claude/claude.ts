import { execFile } from "node:child_process";
import { AgentId, AgentCapabilities, AgentStatus, AgentResponse, agentId, sessionId } from "@arena/core";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "../adapter.js";
import { buildResponse } from "@arena/core";
import { PersistentSession } from "@arena/pty";
import { createPersistentClaude } from "./persistent-session-wrapper.js";

const CLAUDE_COMMAND = "claude";

export class ClaudeAdapter implements AgentAdapter {
  readonly id: AgentId = agentId("claude");
  readonly name = "Claude";
  private detected = false;
  private persistentSessions = new Map<string, PersistentSession>();
  // Fallback for one-shot mode when persistent session creation fails
  private oneShotSessions = new Map<string, { pid: number; alive: boolean }>();

  async detect(): Promise<DetectionResult> {
    return new Promise((resolve) => {
      execFile(CLAUDE_COMMAND, ["--version"], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          this.detected = false;
          resolve({ detected: false, command: CLAUDE_COMMAND });
          return;
        }
        this.detected = true;
        const version = stdout.trim().split("\n")[0] ?? "unknown";
        resolve({ detected: true, command: CLAUDE_COMMAND, version });
      });
    });
  }

  async start(config: { task: string; cwd: string; env?: Record<string, string> }): Promise<AgentSessionHandle> {
    if (!this.detected) await this.detect();
    if (!this.detected) {
      throw new Error("Claude CLI not detected. Run 'arena doctor' to diagnose.");
    }

    try {
      const session = createPersistentClaude({
        cwd: config.cwd,
        env: config.env,
        claudeCommand: CLAUDE_COMMAND,
      });
      this.persistentSessions.set(session.sessionId, session);
      return { sessionId: sessionId(session.sessionId), pid: session.pid };
    } catch {
      // Fallback: one-shot mode
      const sid = `oneshot-${Date.now()}`;
      this.oneShotSessions.set(sid, { pid: 0, alive: true });
      return { sessionId: sessionId(sid), pid: 0 };
    }
  }

  async sendAndReceive(handle: AgentSessionHandle, message: string): Promise<AgentResponse> {
    // Try persistent session first
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) {
      if (!session.isAlive()) {
        return { kind: "crash", content: "Claude process exited" };
      }
      try {
        const output = await session.sendAndWait(message, 120_000);
        return buildResponse(output, message);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "timeout") {
          return { kind: "timeout", content: "Claude did not respond in time" };
        }
        return { kind: "error", content: `Claude error: ${msg}` };
      }
    }

    // Fallback: one-shot mode
    const info = this.oneShotSessions.get(handle.sessionId);
    if (!info) return { kind: "error", content: "Unknown session" };

    try {
      const output = await this.spawnClaude(message);
      return buildResponse(output, message);
    } catch (error) {
      return { kind: "error", content: `Claude error: ${String(error)}` };
    }
  }

  async interrupt(handle: AgentSessionHandle): Promise<void> {
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) session.kill();
  }

  async terminate(handle: AgentSessionHandle): Promise<void> {
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) {
      session.kill();
      this.persistentSessions.delete(handle.sessionId);
    }
    const info = this.oneShotSessions.get(handle.sessionId);
    if (info) {
      info.alive = false;
      this.oneShotSessions.delete(handle.sessionId);
    }
  }

  async getStatus(handle: AgentSessionHandle): Promise<AgentStatus> {
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) return session.isAlive() ? "running" : "stopped";
    const info = this.oneShotSessions.get(handle.sessionId);
    if (!info) return "stopped";
    return info.alive ? "running" : "stopped";
  }

  async capabilities(): Promise<AgentCapabilities> {
    return {
      terminal: true,
      filesystem: true,
      shell: true,
      mcp: false,
      plugins: false,
      network: false,
      interactive: true,
      supportsInterrupt: true,
      supportsResume: false,
    };
  }

  // Fallback one-shot mode
  private spawnClaude(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["-p", prompt, "--output-format", "text"];
      execFile(CLAUDE_COMMAND, args, {
        timeout: 120_000,
        cwd: cwd ?? process.cwd(),
        maxBuffer: 1024 * 1024,
      }, (err, stdout, stderr) => {
        if (err) {
          if (stdout && stdout.trim().length > 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(stderr || String(err)));
          }
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}
