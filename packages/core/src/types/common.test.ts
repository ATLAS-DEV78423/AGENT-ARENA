import { describe, it, expect } from "vitest";
import {
  sessionId,
  agentId,
  eventId,
  findingId,
  roundNumber,
  now,
  durationMs,
  ok,
  err,
  isOk,
  isErr,
} from "./common.js";

describe("branded ID factories", () => {
  it("sessionId creates a branded string", () => {
    const id = sessionId("test-123");
    expect(id).toBe("test-123");
  });

  it("agentId creates a branded string", () => {
    const id = agentId("claude");
    expect(id).toBe("claude");
  });

  it("eventId creates a branded string", () => {
    const id = eventId("evt-1");
    expect(id).toBe("evt-1");
  });

  it("findingId creates a branded string", () => {
    const id = findingId("find-1");
    expect(id).toBe("find-1");
  });

  it("roundNumber creates a branded number", () => {
    const r = roundNumber(3);
    expect(r).toBe(3);
  });

  it("sessionId rejects empty string", () => {
    expect(() => sessionId("")).toThrow("SessionId cannot be empty");
  });

  it("agentId rejects empty string", () => {
    expect(() => agentId("")).toThrow("AgentId cannot be empty");
  });

  it("roundNumber rejects negative", () => {
    expect(() => roundNumber(-1)).toThrow("RoundNumber cannot be negative");
  });
});

describe("timestamps", () => {
  it("now returns ISO 8601 string", () => {
    const ts = now();
    expect(ts).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("durationMs creates branded number", () => {
    const d = durationMs(5000);
    expect(d).toBe(5000);
  });

  it("durationMs rejects negative", () => {
    expect(() => durationMs(-1)).toThrow("DurationMs cannot be negative");
  });
});

describe("Result type", () => {
  it("ok creates success result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it("err creates error result", () => {
    const result = err(new Error("boom"));
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("boom");
  });

  it("isOk identifies success", () => {
    expect(isOk(ok("yes"))).toBe(true);
    expect(isOk(err("no"))).toBe(false);
  });

  it("isErr identifies failure", () => {
    expect(isErr(err("no"))).toBe(true);
    expect(isErr(ok("yes"))).toBe(false);
  });
});
