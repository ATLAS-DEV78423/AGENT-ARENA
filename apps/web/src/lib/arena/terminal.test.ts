import { describe, expect, it } from "vitest";
import { terminalStatus } from "./terminal";

describe("terminalStatus — what a run is tagged when its stream ends", () => {
  it("a completed stream with a consensus outcome stays completed", () => {
    expect(terminalStatus({ kind: "completed", outcome: "consensus" })).toBe("completed");
  });

  it("a clean no-consensus (timeout/deadlock) end stays completed — it is honest, not an error", () => {
    expect(terminalStatus({ kind: "completed", outcome: "timeout" })).toBe("completed");
  });

  it("a completed stream reporting an error outcome tags the session error", () => {
    expect(terminalStatus({ kind: "completed", outcome: "error" })).toBe("error");
  });

  it("an error event tags the session error regardless of outcome", () => {
    expect(terminalStatus({ kind: "error" })).toBe("error");
  });

  it("an unknown outcome is treated as completed — never invented as an error", () => {
    expect(terminalStatus({ kind: "completed", outcome: "unexpected-thing" })).toBe("completed");
  });

  it("a stream that ends without any terminal event keeps the legacy completed behavior", () => {
    expect(terminalStatus({ kind: "none" })).toBe("completed");
  });
});
