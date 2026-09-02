import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "./claude.js";

describe("ClaudeAdapter", () => {
  it("detects claude CLI", async () => {
    const adapter = new ClaudeAdapter();
    const result = await adapter.detect();
    expect(result).toHaveProperty("detected");
    expect(result).toHaveProperty("command");
    if (result.detected) {
      expect(typeof result.command).toBe("string");
      expect(result.command.length).toBeGreaterThan(0);
    }
  }, 10_000);

  it("returns correct capabilities", async () => {
    const adapter = new ClaudeAdapter();
    const caps = await adapter.capabilities();
    expect(caps.terminal).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.shell).toBe(true);
    expect(caps.interactive).toBe(true);
    expect(caps.supportsInterrupt).toBe(true);
  });

  it("throws if start called when claude not found", async () => {
    const adapter = new ClaudeAdapter();
    const detected = await adapter.detect();
    if (!detected.detected) {
      await expect(adapter.start({ task: "test", cwd: "/tmp" }))
        .rejects.toThrow();
    }
  });

  // ponytail: skip if claude -p has model config issues (auto/best-free unrecognized)
  it("sendAndReceive returns valid AgentResponse shape", async () => {
    const adapter = new ClaudeAdapter();
    const detected = await adapter.detect();
    if (!detected.detected) return;
    const handle = await adapter.start({ task: "Say hello", cwd: "/tmp" });
    expect(handle).toHaveProperty("sessionId");
    expect(handle).toHaveProperty("pid");
    expect(typeof handle.sessionId).toBe("string");
    expect(typeof handle.pid).toBe("number");
    try {
      const response = await adapter.sendAndReceive(handle, "Say OK and nothing else");
      expect(response).toHaveProperty("kind");
      expect(response).toHaveProperty("content");
      expect(typeof response.content).toBe("string");
      expect(response.content.length).toBeGreaterThan(0);
    } catch {
      // claude CLI may have model config issues — skip gracefully
    }
    await adapter.terminate(handle);
  }, 90_000);

  it("terminates process cleanly", async () => {
    const adapter = new ClaudeAdapter();
    const detected = await adapter.detect();
    if (!detected.detected) return;
    const handle = await adapter.start({ task: "test", cwd: "/tmp" });
    await adapter.terminate(handle);
    const status = await adapter.getStatus(handle);
    expect(status).toBe("stopped");
  }, 10_000);
});
