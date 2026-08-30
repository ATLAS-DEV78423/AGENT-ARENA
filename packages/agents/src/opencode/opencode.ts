import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AgentId, AgentCapabilities, AgentStatus, agentId, sessionId } from "@arena/core";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "../adapter.js";
import { OrchestratorAdapter, AgentResponse } from "@arena/core";

export interface OpenCodeResponse {
  kind: "analysis" | "message" | "plan_approved" | "plan_rejected"
    | "finding" | "review_approved" | "review_rejected"
    | "final_approved" | "final_rejected" | "error" | "timeout" | "crash";
  content: string;
  data?: Record<string, unknown>;
}

const OPENCODE_COMMAND = "opencode";

export class OpenCodeAdapter implements AgentAdapter, OrchestratorAdapter {
  readonly id: AgentId;
  readonly name: string;
  readonly model: string;
  private detected = false;
  private sessions = new Map<string, { pid: number; alive: boolean }>();

  constructor(model: string) {
    this.model = model;
    // ponytail: derive id and name from model string
    this.id = agentId(model.split("/").pop() ?? model);
    this.name = model.split("/").pop() ?? model;
  }

  async detect(): Promise<DetectionResult> {
    return new Promise((resolve) => {
      exec(`${OPENCODE_COMMAND} --version`, { timeout: 5000 }, (err, stdout) => {
        if (err) {
          this.detected = false;
          resolve({ detected: false, command: OPENCODE_COMMAND });
          return;
        }
        this.detected = true;
        resolve({ detected: true, command: OPENCODE_COMMAND, version: stdout.trim() });
      });
    });
  }

  async start(_config: { task: string; cwd: string }): Promise<AgentSessionHandle> {
    if (!this.detected) throw new Error("opencode not detected");
    const sid = sessionId(randomUUID());
    this.sessions.set(sid as string, { pid: 0, alive: true });
    return { sessionId: sid, pid: 0 };
  }

  // ponytail: pipe message to stdin, capture stdout. Simpler than PTY for one-shot.
  async sendAndReceive(_handle: { sessionId: string }, message: string): Promise<AgentResponse> {
    try {
      const output = await this.runOpenCode(message);
      return { kind: "message", content: output };
    } catch (error) {
      return { kind: "error", content: `opencode error: ${String(error)}` };
    }
  }

  async send(_handle: AgentSessionHandle, _message: string): Promise<void> { /* unused */ }
  async interrupt(_handle: AgentSessionHandle): Promise<void> { /* one-shot, no interrupt */ }

  async terminate(handle: AgentSessionHandle): Promise<void> {
    const info = this.sessions.get(handle.sessionId);
    if (info) {
      info.alive = false;
      this.sessions.delete(handle.sessionId);
    }
  }

  async getStatus(handle: AgentSessionHandle): Promise<AgentStatus> {
    const info = this.sessions.get(handle.sessionId);
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
      interactive: false,
      supportsInterrupt: false,
      supportsResume: false,
    };
  }

  // ponytail: exec with stdin pipe, 120s timeout, capture stdout only.
  // opencode prints a header line (> build · model) then the response.
  // We strip that header and return the actual content.
  private runOpenCode(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `${OPENCODE_COMMAND} run -m ${this.model} --pure --dir ${cwd ?? process.cwd()}`;
      const child = exec(cmd, {
        timeout: 120_000,
        cwd: cwd ?? process.cwd(),
        maxBuffer: 1024 * 1024,
      });

      // Pipe prompt to stdin
      child.stdin?.write(prompt);
      child.stdin?.end();

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code) => {
        // ponytail: opencode prints "> build · model\n\n<response>"
        // Strip the header line
        const cleaned = stdout.replace(/^>.*\n+/, "").trim();
        if (cleaned.length > 0) {
          resolve(cleaned);
        } else if (code !== 0 && stderr) {
          reject(new Error(stderr.trim()));
        } else {
          resolve(stdout.trim());
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }
}
