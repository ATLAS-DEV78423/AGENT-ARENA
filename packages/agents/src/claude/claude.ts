import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AgentId, AgentCapabilities, AgentStatus, agentId, sessionId } from "@arena/core";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "../adapter.js";

interface ClaudeResponse {
  kind: "analysis" | "message" | "plan_approved" | "plan_rejected"
    | "finding" | "review_approved" | "review_rejected"
    | "final_approved" | "final_rejected" | "error" | "timeout" | "crash";
  content: string;
  data?: Record<string, unknown>;
}

const CLAUDE_COMMAND = "claude";

export class ClaudeAdapter implements AgentAdapter {
  readonly id: AgentId = agentId("claude");
  readonly name = "Claude";
  private detected = false;
  private paths = new Map<string, { pid: number; alive: boolean }>();

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

  async start(_config: { task: string; cwd: string; env?: Record<string, string> }): Promise<AgentSessionHandle> {
    if (!this.detected) {
      throw new Error("Claude CLI not detected. Run 'arena doctor' to diagnose.");
    }
    const sid = sessionId(randomUUID());
    // ponytail: for initial version, we don't actually spawn claude in start()
    // The real spawn happens in sendAndReceive() using claude -p "prompt"
    // This keeps things simple — one process per message
    this.paths.set(sid, { pid: 0, alive: true });
    return { sessionId: sid, pid: 0 };
  }

  async sendAndReceive(handle: AgentSessionHandle, message: string): Promise<ClaudeResponse> {
    const info = this.paths.get(handle.sessionId);
    if (!info) throw new Error("Unknown session");

    try {
      const output = await this.spawnClaude(message);
      return { kind: "message", content: output };
    } catch (error) {
      return { kind: "error", content: `Claude error: ${String(error)}` };
    }
  }

  async send(_handle: AgentSessionHandle, _message: string): Promise<void> {
    // Not used directly — sendAndReceive is the primary interface
  }

  async interrupt(_handle: AgentSessionHandle): Promise<void> {
    // ponytail: kill any running process. For one-shot mode, interrupt = cancel
  }

  async terminate(handle: AgentSessionHandle): Promise<void> {
    const info = this.paths.get(handle.sessionId);
    if (info) {
      info.alive = false;
      this.paths.delete(handle.sessionId);
    }
  }

  async getStatus(handle: AgentSessionHandle): Promise<AgentStatus> {
    const info = this.paths.get(handle.sessionId);
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

  // ponytail: one-shot mode, simplest possible. Spawn claude -p, capture stdout, return.
  // Add PTY persistent sessions when interactive mode is needed.
  private spawnClaude(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ["-p", prompt, "--output-format", "text"];
      execFile(CLAUDE_COMMAND, args, {
        timeout: 120_000,
        cwd: cwd ?? process.cwd(),
        maxBuffer: 1024 * 1024,
      }, (err, stdout, stderr) => {
        if (err) {
          // ponytail: if claude exits non-zero, check if we got useful output anyway
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
