import { describe, it, expect, afterEach } from "vitest";
import { PersistentSession } from "./persistent-session.js";
import { createDelimiter } from "./delimiter.js";

// Fake agent script: reads lines from stdin, echoes back with delimiter
const ECHO_AGENT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const delim = process.env.ARENA_DELIM || '__DEFAULT_DELIM__';
rl.on('line', (line) => {
  process.stdout.write(delim + '\\n');
  process.stdout.write('echo: ' + line + '\\n');
  process.stdout.write(delim + '\\n');
});
`;

describe("PersistentSession", () => {
  let sessions: PersistentSession[] = [];

  afterEach(async () => {
    for (const s of sessions) if (s.isAlive()) s.kill();
    sessions = [];
  });

  it("spawns a process and stays alive", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "process.stdin.resume()"],
    });
    sessions.push(s);
    expect(s.isAlive()).toBe(true);
    expect(s.pid).toBeGreaterThan(0);
  });

  it("sends a message and receives a delimited response", async () => {
    const delim = createDelimiter();
    const s = new PersistentSession({
      command: "node",
      args: ["-e", ECHO_AGENT],
      env: { ARENA_DELIM: delim.end },
      delimiter: delim,
    });
    sessions.push(s);

    const response = await s.sendAndWait("hello world", 5000);
    expect(response).toContain("echo: hello world");
  });

  it("times out when no response arrives", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "process.stdin.resume()"],
    });
    sessions.push(s);

    await expect(s.waitForResponse(200)).rejects.toThrow("timeout");
  });

  it("kill terminates the process", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "setTimeout(() => {}, 30000)"],
    });
    sessions.push(s);
    expect(s.isAlive()).toBe(true);
    s.kill();
    await new Promise<void>((r) => s.onExit(() => r()));
    expect(s.isAlive()).toBe(false);
  });

  it("multiple send/receive cycles work", async () => {
    const delim = createDelimiter();
    const s = new PersistentSession({
      command: "node",
      args: ["-e", ECHO_AGENT],
      env: { ARENA_DELIM: delim.end },
      delimiter: delim,
    });
    sessions.push(s);

    const r1 = await s.sendAndWait("first", 5000);
    expect(r1).toContain("echo: first");

    const r2 = await s.sendAndWait("second", 5000);
    expect(r2).toContain("echo: second");
  });
});
