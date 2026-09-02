import { exec } from "node:child_process";
import { AgentId, AgentCapabilities, AgentStatus, AgentResponse, agentId, sessionId as brandedSessionId } from "@arena/core";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "../adapter.js";
import { OrchestratorAdapter } from "@arena/core";
import { buildResponse } from "../response-parser.js";
import { PersistentSession } from "@arena/pty";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELAY_SCRIPT = join(__dirname, "opencode-relay.mjs");
const OPENCODE_COMMAND = "opencode";

export class OpenCodeAdapter implements AgentAdapter, OrchestratorAdapter {
  readonly id: AgentId;
  readonly name: string;
  readonly model: string;
  private detected = false;
  private persistentSessions = new Map<string, PersistentSession>();
  private oneShotSessions = new Map<string, { pid: number; alive: boolean }>();

  constructor(model: string) {
    this.model = model;
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

  async start(config: { task: string; cwd: string }): Promise<AgentSessionHandle> {
    if (!this.detected) await this.detect();
    if (!this.detected) throw new Error("opencode not detected. Install opencode: npm i -g opencode");

    try {
      const session = new PersistentSession({
        command: "node",
        args: [RELAY_SCRIPT],
        cwd: config.cwd,
        env: {
          ARENA_OPENCODE_CMD: OPENCODE_COMMAND,
          ARENA_MODEL: this.model,
          ARENA_TIMEOUT: "120000",
        },
      });
      this.persistentSessions.set(session.sessionId, session);
      return { sessionId: brandedSessionId(session.sessionId), pid: session.pid };
    } catch {
      const sid = `oneshot-${Date.now()}`;
      this.oneShotSessions.set(sid, { pid: 0, alive: true });
      return { sessionId: brandedSessionId(sid), pid: 0 };
    }
  }

  async sendAndReceive(handle: { sessionId: string }, message: string): Promise<AgentResponse> {
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) {
      if (!session.isAlive()) {
        return { kind: "crash", content: "OpenCode process exited" };
      }
      try {
        const output = await session.sendAndWait(message, 120_000);
        return buildResponse(output, message);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "timeout") {
          return { kind: "timeout", content: "OpenCode did not respond in time" };
        }
        return { kind: "error", content: `opencode error: ${msg}` };
      }
    }

    const info = this.oneShotSessions.get(handle.sessionId);
    if (!info) return { kind: "error", content: "Unknown session" };

    try {
      const output = await this.runOpenCode(message);
      return buildResponse(output, message);
    } catch (error) {
      return { kind: "error", content: `opencode error: ${String(error)}` };
    }
  }

  async send(_handle: AgentSessionHandle, _message: string): Promise<void> {}
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
      interactive: false,
      supportsInterrupt: false,
      supportsResume: false,
    };
  }

  // Fallback one-shot mode
  private runOpenCode(prompt: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `${OPENCODE_COMMAND} run -m ${this.model} --pure --dir ${cwd ?? process.cwd()}`;
      const child = exec(cmd, {
        timeout: 120_000,
        cwd: cwd ?? process.cwd(),
        maxBuffer: 1024 * 1024,
      });

      child.stdin?.write(prompt);
      child.stdin?.end();

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code) => {
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
