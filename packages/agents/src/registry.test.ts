import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "./registry.js";
import { AgentAdapter, DetectionResult } from "./adapter.js";
import { agentId, AgentId, AgentStatus, AgentCapabilities, SessionId } from "@arena/core";

function mock(id: string, name: string, detected: boolean): AgentAdapter {
  return {
    id: agentId(id), name,
    async detect(): Promise<DetectionResult> { return { detected, command: name.toLowerCase() }; },
    async start() { return { sessionId: "mock" as SessionId, pid: 1234 }; },
    async send() {}, async interrupt() {}, async terminate() {},
    async getStatus(): Promise<AgentStatus> { return "idle"; },
    async capabilities(): Promise<AgentCapabilities> { return { terminal: true, filesystem: true, shell: true, mcp: false, plugins: false, network: false, interactive: true, supportsInterrupt: true, supportsResume: false }; },
  };
}

describe("AgentRegistry", () => {
  let r: AgentRegistry;
  beforeEach(() => { r = new AgentRegistry(); r.register(mock("claude", "Claude", true)); r.register(mock("codex", "Codex", false)); });
  it("registers adapters", () => expect(r.getAll()).toHaveLength(2));
  it("detects available agents", async () => {
    const results = await r.detectAll();
    expect(results.find(x => x.adapter.id === "claude")?.detected).toBe(true);
    expect(results.find(x => x.adapter.id === "codex")?.detected).toBe(false);
  });
  it("gets detected only", async () => expect((await r.getDetected()).length).toBe(1));
  it("gets by id", () => expect(r.getById(agentId("claude"))?.name).toBe("Claude"));
});
