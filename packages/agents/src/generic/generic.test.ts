import { describe, it, expect } from "vitest";
import { GenericAgentAdapter } from "./generic.js";

// Simple echo agent for testing
const ECHO_SCRIPT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  process.stdout.write('Got: ' + line + '\\n');
});
`;

describe("GenericAgentAdapter", () => {
  it("detects when command exists", async () => {
    const adapter = new GenericAgentAdapter({
      id: "node-agent",
      command: "node",
      args: ["--version"],
    });
    const result = await adapter.detect();
    expect(result.detected).toBe(true);
    expect(result.command).toBe("node");
  });

  it("detects when command does not exist", async () => {
    const adapter = new GenericAgentAdapter({
      id: "fake",
      command: "nonexistent-command-xyz",
    });
    const result = await adapter.detect();
    expect(result.detected).toBe(false);
  });

  it("capabilities returns reasonable defaults", async () => {
    const adapter = new GenericAgentAdapter({
      id: "test",
      command: "echo",
    });
    const caps = await adapter.capabilities();
    expect(caps.terminal).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.shell).toBe(true);
  });

  it("start launches a session", async () => {
    const adapter = new GenericAgentAdapter({
      id: "echo-agent",
      command: "node",
      args: ["-e", ECHO_SCRIPT],
    });
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    expect(handle.sessionId).toBeTruthy();
    expect(handle.pid).toBeGreaterThan(0);
    await adapter.terminate(handle);
  });
});
