import { describe, it, expect, afterEach } from "vitest";
import { PtyAgentAdapter } from "./pty-adapter.js";
import { agentId } from "@arena/core";

// Echo agent that uses ARENA_DELIM env var for response boundaries
const ECHO_AGENT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const delim = process.env.ARENA_DELIM || '';
rl.on('line', (line) => {
  if (delim) process.stdout.write(delim + '\\n');
  process.stdout.write('Got: ' + line + '\\n');
  if (delim) process.stdout.write(delim + '\\n');
});
`;

describe("PtyAgentAdapter", () => {
  let adapter: PtyAgentAdapter;

  afterEach(() => {
    if (adapter) adapter.terminate({ sessionId: "x" }).catch(() => {});
  });

  it("implements OrchestratorAdapter interface", () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", ECHO_AGENT],
    );
    expect(adapter.id).toBe("test");
    expect(adapter.name).toBe("Test Agent");
  });

  it("start returns a session handle", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", ECHO_AGENT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    expect(handle.sessionId).toBeTruthy();
    expect(handle.pid).toBeGreaterThan(0);
  });

  it("sendAndReceive returns agent response", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", ECHO_AGENT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    const response = await adapter.sendAndReceive(handle, "hello");
    expect(response.content).toContain("Got: hello");
    expect(response.kind).toBe("message");
  });

  it("terminate kills the process", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", ECHO_AGENT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    await adapter.terminate(handle);
    await new Promise((r) => setTimeout(r, 100));
  });
});
