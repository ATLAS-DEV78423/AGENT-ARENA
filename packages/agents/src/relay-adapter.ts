import { execFile } from "node:child_process";
import { AgentId, AgentCapabilities, AgentStatus, AgentResponse, sessionId as brandedSessionId } from "@arena/core";
import { buildResponse } from "@arena/core";
import type { OrchestratorAdapter } from "@arena/core";
import { PersistentSession } from "@arena/pty";
import { AgentAdapter, DetectionResult, AgentSessionHandle } from "./adapter.js";

// Sentinel the relays use to frame one multi-line prompt as a single model
// call. Must match the default in the relay scripts.
export const PROMPT_DELIM = "__ARENA_PROMPT_END__";

/** Steady per-call budget for a live agent (every call after the first). */
export const DEFAULT_CALL_TIMEOUT_MS = 120_000;
/**
 * Budget for the first call on a relay process — a cold start (process spawn +
 * provider handshake + first token) routinely exceeds the steady budget.
 */
export const DEFAULT_FIRST_CALL_TIMEOUT_MS = 300_000;

export interface RelayAdapterConfig {
  /** CLI binary that answers `--version` (e.g. "opencode", "claude"). */
  cliCommand: string;
  /** Relay script file next to the subclass (e.g. "opencode-relay.mjs"). */
  relayScript: string;
  /** Env var the relay reads for the CLI command. */
  cliEnvVar: string;
  /** Extra env passed to the relay process (e.g. the model to run). */
  relayEnv?: Record<string, string>;
  /** Error thrown when the CLI is not installed. */
  notDetectedError: string;
  /** Display label used in crash/timeout messages ("OpenCode", "Claude"). */
  label: string;
  /** Steady per-call budget in ms (default DEFAULT_CALL_TIMEOUT_MS). */
  timeoutMs?: number;
  /** First-call-on-a-relay budget in ms (default DEFAULT_FIRST_CALL_TIMEOUT_MS). */
  firstCallTimeoutMs?: number;
  interactive?: boolean;
  supportsInterrupt?: boolean;
}

/**
 * Adapter that drives a model CLI through a persistent relay process: each
 * sendAndReceive frames the (multi-line) prompt with PROMPT_DELIM, the relay
 * runs the CLI once, and the delimited response is classified by buildResponse.
 * Falls back to one-shot runs if the relay cannot start.
 */
export abstract class PersistentRelayAdapter implements AgentAdapter, OrchestratorAdapter {
  abstract readonly id: AgentId;
  abstract readonly name: string;
  protected detected = false;
  protected persistentSessions = new Map<string, PersistentSession>();
  protected oneShotSessions = new Map<string, { pid: number; alive: boolean }>();
  /** Calls sent per relay session — the first on each process gets the cold-start budget. */
  private callsPerSession = new Map<string, number>();
  protected readonly timeoutMs: number;
  protected readonly firstCallTimeoutMs: number;

  constructor(private readonly relay: RelayAdapterConfig) {
    this.timeoutMs = relay.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
    this.firstCallTimeoutMs =
      relay.firstCallTimeoutMs ?? DEFAULT_FIRST_CALL_TIMEOUT_MS;
  }

  /** Budget for the given session's next call (first call on the relay = cold start). */
  protected nextCallTimeoutMs(sessionId: string): number {
    const calls = this.callsPerSession.get(sessionId) ?? 0;
    this.callsPerSession.set(sessionId, calls + 1);
    return calls === 0 ? this.firstCallTimeoutMs : this.timeoutMs;
  }

  async detect(): Promise<DetectionResult> {
    return new Promise((resolve) => {
      execFile(this.relay.cliCommand, ["--version"], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          this.detected = false;
          resolve({ detected: false, command: this.relay.cliCommand });
          return;
        }
        this.detected = true;
        const version = stdout.trim().split("\n")[0] ?? "unknown";
        resolve({ detected: true, command: this.relay.cliCommand, version });
      });
    });
  }

  async start(config: { task: string; cwd: string; env?: Record<string, string> }): Promise<AgentSessionHandle> {
    if (!this.detected) await this.detect();
    if (!this.detected) throw new Error(this.relay.notDetectedError);

    try {
      const session = new PersistentSession({
        command: "node",
        args: [this.relay.relayScript],
        cwd: config.cwd,
        env: {
          [this.relay.cliEnvVar]: this.relay.cliCommand,
          ARENA_TIMEOUT: String(this.timeoutMs),
          ARENA_FIRST_CALL_TIMEOUT: String(this.firstCallTimeoutMs),
          ...this.relay.relayEnv,
          ...config.env,
        },
      });
      this.persistentSessions.set(session.sessionId, session);
      return { sessionId: brandedSessionId(session.sessionId), pid: session.pid };
    } catch {
      // Fallback: one-shot mode
      const sid = `oneshot-${Date.now()}`;
      this.oneShotSessions.set(sid, { pid: 0, alive: true });
      return { sessionId: brandedSessionId(sid), pid: 0 };
    }
  }

  async sendAndReceive(handle: { sessionId: string; pid?: number }, message: string): Promise<AgentResponse> {
    const session = this.persistentSessions.get(handle.sessionId);
    if (session) {
      if (!session.isAlive()) {
        return { kind: "crash", content: `${this.relay.label} process exited` };
      }
      try {
        const output = await session.sendAndWait(
          `${message}\n${PROMPT_DELIM}`,
          this.nextCallTimeoutMs(handle.sessionId),
        );
        return buildResponse(output, message);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "timeout") {
          return { kind: "timeout", content: `${this.relay.label} did not respond in time` };
        }
        return { kind: "error", content: `${this.relay.label.toLowerCase()} error: ${msg}` };
      }
    }

    const info = this.oneShotSessions.get(handle.sessionId);
    if (!info) return { kind: "error", content: "Unknown session" };

    try {
      const output = await this.runOneShot(message);
      return buildResponse(output, message);
    } catch (error) {
      return { kind: "error", content: `${this.relay.label.toLowerCase()} error: ${String(error)}` };
    }
  }

  async interrupt(handle: AgentSessionHandle): Promise<void> {
    this.persistentSessions.get(handle.sessionId)?.kill();
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
      interactive: this.relay.interactive ?? false,
      supportsInterrupt: this.relay.supportsInterrupt ?? false,
      supportsResume: false,
    };
  }

  /** Provider-specific fallback when the persistent relay cannot start. */
  protected abstract runOneShot(prompt: string): Promise<string>;
}