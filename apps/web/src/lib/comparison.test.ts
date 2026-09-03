import { describe, it, expect } from "vitest";
import { comparisonColumns, verdictMessage } from "./comparison";
import type { Message } from "./types";

const msg = (over: Partial<Message> & { id: string }): Message => ({
  role: "arena",
  content: "content",
  timestamp: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("comparisonColumns", () => {
  it("buckets arena messages by agent, preserving arrival order", () => {
    const messages = [
      msg({ id: "u", role: "user", content: "prompt" }),
      msg({ id: "a1", agentId: "alpha", agentName: "Alpha", content: "first" }),
      msg({ id: "b1", agentId: "beta", agentName: "Beta", content: "first" }),
      msg({ id: "a2", agentId: "alpha", agentName: "Alpha", content: "second" }),
      msg({ id: "j", role: "judge", agentId: "judge", agentName: "Judge", content: "verdict" }),
    ];

    const columns = comparisonColumns(messages);

    expect(columns.map((c) => c.agentId)).toEqual(["alpha", "beta"]);
    expect(columns[0]!.messages.map((m) => m.content)).toEqual(["first", "second"]);
    expect(columns[1]!.messages.map((m) => m.content)).toEqual(["first"]);
  });

  it("uses agentId as name when agentName is missing", () => {
    const [column] = comparisonColumns([msg({ id: "a", agentId: "alpha" })]);
    expect(column!.agentName).toBe("alpha");
  });

  it("returns an empty list when there are no arena messages", () => {
    expect(comparisonColumns([msg({ id: "u", role: "user" })])).toEqual([]);
  });
});

describe("verdictMessage", () => {
  it("returns the last judge message", () => {
    const messages = [
      msg({ id: "j1", role: "judge", content: "first verdict" }),
      msg({ id: "a", agentId: "alpha" }),
      msg({ id: "j2", role: "judge", content: "final verdict" }),
    ];
    expect(verdictMessage(messages)?.content).toBe("final verdict");
  });

  it("returns undefined when there is no judge message", () => {
    expect(verdictMessage([msg({ id: "a", agentId: "alpha" })])).toBeUndefined();
  });
});