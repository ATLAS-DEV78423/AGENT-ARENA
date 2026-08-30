import { createProcessSession, ProcessSessionHandle } from "./session.js";

export class ProcessManager {
  private sessions = new Map<string, ProcessSessionHandle>();
  spawn(opts: { command: string; args?: string[]; cwd?: string }): ProcessSessionHandle {
    const handle = createProcessSession(opts);
    this.sessions.set(handle.sessionId, handle);
    return handle;
  }
  getSession(id: string) { return this.sessions.get(id); }
  async killAll() { for (const h of this.sessions.values()) if (h.isAlive()) h.kill(); this.sessions.clear(); }
  get activeCount() { let n = 0; for (const h of this.sessions.values()) if (h.isAlive()) n++; return n; }
}
