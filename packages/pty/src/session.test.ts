import { describe, it, expect } from "vitest";
import { createProcessSession } from "./session.js";

describe("createProcessSession", () => {
  it("spawns a process and captures output", async () => {
    const session = createProcessSession({ command: "echo", args: ["hello"] });
    expect(session.sessionId).toBeTruthy();
    expect(session.pid).toBeGreaterThan(0);
    expect(session.isAlive()).toBe(true);

    const output = await new Promise<string>((resolve) => {
      let data = "";
      session.onData((d) => { data += d; });
      session.onExit(() => resolve(data));
    });

    expect(output).toContain("hello");
    expect(session.isAlive()).toBe(false);
  });

  it("can write to process stdin", async () => {
    const session = createProcessSession({ command: "cat" });
    session.write("echoed\n");

    const output = await new Promise<string>((resolve) => {
      let data = "";
      session.onData((d) => { data += d; });
      session.onExit(() => resolve(data));
      setTimeout(() => session.kill(), 500);
    });

    expect(output).toContain("echoed");
  });

  it("kill terminates the process", async () => {
    const session = createProcessSession({ command: "node", args: ["-e", "setTimeout(() => {}, 10000)"] });
    expect(session.isAlive()).toBe(true);
    session.kill();

    await new Promise<void>((resolve) => {
      session.onExit(() => resolve());
    });

    expect(session.isAlive()).toBe(false);
  });

  it("onExit callback fires with exit code", async () => {
    const session = createProcessSession({ command: "node", args: ["-e", "process.exit(42)"] });
    const exitCode = await new Promise<number>((resolve) => {
      session.onExit((code) => resolve(code));
    });
    expect(exitCode).toBe(42);
  });

  it("getOutput returns accumulated output", async () => {
    const session = createProcessSession({ command: "echo", args: ["test-data"] });
    await new Promise<void>((resolve) => {
      session.onExit(() => resolve());
    });
    expect(session.getOutput().contains("test-data")).toBe(true);
  });
});
