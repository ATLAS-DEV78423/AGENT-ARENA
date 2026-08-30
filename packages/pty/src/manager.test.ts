import { describe, it, expect } from "vitest";
import { ProcessManager } from "./manager.js";

describe("ProcessManager", () => {
  it("spawns and tracks a process", async () => {
    const mgr = new ProcessManager();
    const session = mgr.spawn({ command: "echo", args: ["hello"] });
    expect(mgr.activeCount).toBe(1);
    expect(mgr.getSession(session.sessionId)).toBe(session);

    await new Promise<void>((resolve) => {
      session.onExit(() => resolve());
    });

    expect(mgr.activeCount).toBe(0);
  });

  it("getSession returns undefined for unknown id", () => {
    const mgr = new ProcessManager();
    expect(mgr.getSession("nonexistent")).toBeUndefined();
  });

  it("killAll terminates all processes", async () => {
    const mgr = new ProcessManager();
    mgr.spawn({ command: "node", args: ["-e", "setTimeout(() => {}, 10000)"] });
    mgr.spawn({ command: "node", args: ["-e", "setTimeout(() => {}, 10000)"] });
    expect(mgr.activeCount).toBe(2);

    await mgr.killAll();
    expect(mgr.activeCount).toBe(0);
  });

  it("activeCount tracks only alive processes", async () => {
    const mgr = new ProcessManager();
    const s1 = mgr.spawn({ command: "echo", args: ["done"] });
    mgr.spawn({ command: "node", args: ["-e", "setTimeout(() => {}, 10000)"] });
    expect(mgr.activeCount).toBe(2);

    await new Promise<void>((resolve) => {
      s1.onExit(() => resolve());
    });

    expect(mgr.activeCount).toBe(1);
    await mgr.killAll();
  });
});
