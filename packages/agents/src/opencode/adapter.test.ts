import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "./opencode.js";

// Live-model tests call a real (billable) agent CLI. Opt in with ARENA_LIVE_TESTS=1.
const live = process.env.ARENA_LIVE_TESTS === "1";

describe("OpenCodeAdapter", () => {
  it("detects opencode CLI", async () => {
    const adapter = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const result = await adapter.detect();
    expect(result).toHaveProperty("detected");
    expect(result).toHaveProperty("command");
    if (result.detected) {
      expect(result.command).toBe("opencode");
    }
  }, 10_000);

  it("returns correct capabilities", async () => {
    const adapter = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const caps = await adapter.capabilities();
    expect(caps.terminal).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.shell).toBe(true);
    expect(caps.interactive).toBe(false); // one-shot mode
    expect(caps.supportsInterrupt).toBe(false);
    expect(caps.supportsResume).toBe(false);
  });

  it("throws if start called when opencode not found", async () => {
    const adapter = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const detected = await adapter.detect();
    if (!detected.detected) {
      await expect(adapter.start({ task: "test", cwd: "/tmp" }))
        .rejects.toThrow();
    }
  });

  it.skipIf(!live)("sendAndReceive returns valid AgentResponse", async () => {
    const adapter = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const detected = await adapter.detect();
    if (!detected.detected) return;
    const handle = await adapter.start({ task: "Say hello", cwd: "/tmp" });
    expect(handle).toHaveProperty("sessionId");
    expect(handle).toHaveProperty("pid");
    const response = await adapter.sendAndReceive(handle, "Reply with only the word OK");
    expect(response).toHaveProperty("kind");
    expect(response).toHaveProperty("content");
    expect(typeof response.content).toBe("string");
    expect(response.content.length).toBeGreaterThan(0);
    await adapter.terminate(handle);
  }, 90_000);

  it("two adapters can use different models", async () => {
    const a = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const b = new OpenCodeAdapter("opencode/mimo-v2.5-free");
    expect(a.model).not.toBe(b.model);
  });

  it("terminates cleanly", async () => {
    const adapter = new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free");
    const detected = await adapter.detect();
    if (!detected.detected) return;
    const handle = await adapter.start({ task: "test", cwd: "/tmp" });
    await adapter.terminate(handle);
    const status = await adapter.getStatus(handle);
    expect(status).toBe("stopped");
  });
});
