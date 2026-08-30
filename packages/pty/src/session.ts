import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { OutputBuffer } from "./stream.js";

export interface ProcessSessionHandle {
  sessionId: string; pid: number; write(data: string): void;
  onData(cb: (data: string) => void): () => void;
  onExit(cb: (code: number, signal?: number) => void): () => void;
  kill(signal?: NodeJS.Signals): void; getOutput(): OutputBuffer; isAlive(): boolean;
}

export function createProcessSession(opts: { command: string; args?: string[]; cwd?: string; env?: Record<string, string> }): ProcessSessionHandle {
  const buffer = new OutputBuffer();
  const dataCbs: Array<(d: string) => void> = [];
  const exitCbs: Array<(c: number, s?: number) => void> = [];
  let alive = true;
  const child = spawn(opts.command, opts.args ?? [], { cwd: opts.cwd ?? process.cwd(), env: { ...process.env, ...opts.env }, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout?.on("data", (d: Buffer) => { const s = d.toString(); buffer.append(s); for (const cb of dataCbs) cb(s); });
  child.stderr?.on("data", (d: Buffer) => { const s = d.toString(); buffer.append(s); for (const cb of dataCbs) cb(s); });
  child.on("exit", (code, signal) => { alive = false; for (const cb of exitCbs) cb(code ?? 1, signal ?? undefined); });
  return {
    sessionId: randomUUID(), pid: child.pid ?? 0,
    write: (d) => child.stdin?.write(d),
    onData: (cb) => { dataCbs.push(cb); return () => { const i = dataCbs.indexOf(cb); if (i >= 0) dataCbs.splice(i, 1); }; },
    onExit: (cb) => { exitCbs.push(cb); return () => { const i = exitCbs.indexOf(cb); if (i >= 0) exitCbs.splice(i, 1); }; },
    kill: (s) => { if (alive) child.kill(s); },
    getOutput: () => buffer, isAlive: () => alive,
  };
}
