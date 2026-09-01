import { spawn, SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  DelimiterPair,
  createDelimiter,
} from "./delimiter.js";
import { ResponseBuffer } from "./response-buffer.js";

export interface PersistentSessionConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  delimiter?: DelimiterPair;
}

export class PersistentSession {
  readonly sessionId: string;
  readonly pid: number;
  private child: ReturnType<typeof spawn>;
  private buffer: ResponseBuffer;
  private alive = true;
  private waitingResolve: ((value: string) => void) | null = null;

  private exitCallbacks: Array<() => void> = [];

  constructor(config: PersistentSessionConfig) {
    this.sessionId = randomUUID();
    const delimiter = config.delimiter ?? createDelimiter();
    this.buffer = new ResponseBuffer(delimiter);

    const opts: SpawnOptions = {
      cwd: config.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ARENA_DELIM: delimiter.end,
        ...config.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    };

    this.child = spawn(config.command, config.args ?? [], opts);
    this.pid = this.child.pid ?? 0;

    this.child.stdout?.on("data", (d: Buffer) => {
      this.buffer.append(d.toString());
      this.resolveIfReady();
    });

    this.child.stderr?.on("data", (d: Buffer) => {
      this.buffer.append(d.toString());
      this.resolveIfReady();
    });

    this.child.on("exit", () => {
      this.alive = false;
      for (const cb of this.exitCallbacks) cb();
    });
  }

  send(message: string): void {
    if (!this.alive) throw new Error("Session is not alive");
    this.child.stdin?.write(message + "\n");
  }

  async sendAndWait(
    message: string,
    timeoutMs = 30_000,
  ): Promise<string> {
    this.buffer.clear();
    this.send(message);
    return this.waitForResponse(timeoutMs);
  }

  waitForResponse(timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.waitingResolve) {
        reject(new Error("Already waiting for a response"));
        return;
      }

      this.waitingResolve = resolve;

      // Check if response already arrived
      this.resolveIfReady();

      if (this.waitingResolve) {
        const timer = setTimeout(() => {
          if (this.waitingResolve) {
            this.waitingResolve = null;
            reject(new Error("timeout"));
          }
        }, timeoutMs);

        const origResolve = this.waitingResolve;
        this.waitingResolve = (v) => {
          clearTimeout(timer);
          origResolve(v);
        };
      }
    });
  }

  private resolveIfReady(): void {
    if (!this.waitingResolve) return;
    if (!this.buffer.hasCompleteResponse()) return;

    const response = this.buffer.consumeResponse();
    this.resolvePending(response);
  }

  private resolvePending(response: string): void {
    const resolve = this.waitingResolve;
    this.waitingResolve = null;
    resolve?.(response);
  }

  isAlive(): boolean {
    return this.alive;
  }

  kill(signal?: NodeJS.Signals): void {
    if (this.alive) this.child.kill(signal);
  }

  onExit(cb: () => void): void {
    this.exitCallbacks.push(cb);
  }
}
