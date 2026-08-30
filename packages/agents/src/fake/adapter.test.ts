import { describe, it, expect } from "vitest";
import { FakeAgentAdapter } from "./adapter.js";
import { agentId } from "@arena/core";

describe("FakeAgentAdapter", () => {
  it("always detects", async () => {
    const a = new FakeAgentAdapter(agentId("fake-a"), "Fake A");
    expect((await a.detect()).detected).toBe(true);
  });
  it("starts and emits greeting", async () => {
    const a = new FakeAgentAdapter(agentId("fake-a"), "Fake A");
    const msgs: string[] = [];
    a.onOutput(d => msgs.push(d));
    await a.start({ task: "Build X", cwd: "/tmp" });
    expect(msgs.some(m => m.includes("Build X"))).toBe(true);
  });
  it("sends scripted response", async () => {
    const a = new FakeAgentAdapter(agentId("a"), "A", [{ trigger: "analysis", response: "I understand the task" }]);
    const msgs: string[] = [];
    a.onOutput(d => msgs.push(d));
    const h = await a.start({ task: "test", cwd: "/tmp" });
    await a.send(h, "Provide your analysis");
    expect(msgs.some(m => m.includes("I understand"))).toBe(true);
  });
});
