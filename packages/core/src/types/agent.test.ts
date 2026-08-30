import { describe, it, expect } from "vitest";
import { createAgentProfile } from "./agent.js";
import { agentId } from "./common.js";

describe("createAgentProfile", () => {
  it("creates profile with detectedAt", () => {
    const p = createAgentProfile({
      id: agentId("claude"), name: "Claude", command: "claude", args: ["--print"],
      capabilities: { terminal: true, filesystem: true, shell: true, mcp: true, plugins: false, network: true, interactive: true, supportsInterrupt: true, supportsResume: false },
    });
    expect(p.id).toBe("claude");
    expect(p.detectedAt).toBeTruthy();
  });
});
