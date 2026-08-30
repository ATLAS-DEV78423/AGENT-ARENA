import { describe, it, expect } from "vitest";
import { VerificationEngine } from "./engine.js";

describe("VerificationEngine", () => {
  it("runs a passing command", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [{ name: "echo", cmd: "echo", args: ["ok"] }],
    });
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.name).toBe("echo");
    expect(result.checks[0]!.passed).toBe(true);
  }, 15_000);

  it("runs a failing command", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [{ name: "fail", cmd: "node", args: ["-e", "process.exit(1)"] }],
    });
    expect(result.passed).toBe(false);
    expect(result.checks[0]!.passed).toBe(false);
    expect(result.checks[0]!.exitCode).toBe(1);
  }, 15_000);

  it("runs multiple commands and reports overall status", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [
        { name: "pass1", cmd: "echo", args: ["ok"] },
        { name: "pass2", cmd: "echo", args: ["ok"] },
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(2);
  }, 15_000);

  it("fails if any command fails", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [
        { name: "pass", cmd: "echo", args: ["ok"] },
        { name: "fail", cmd: "node", args: ["-e", "process.exit(1)"] },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.checks.find(c => c.name === "pass")!.passed).toBe(true);
    expect(result.checks.find(c => c.name === "fail")!.passed).toBe(false);
  }, 15_000);

  it("captures stdout and stderr", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [{ name: "output", cmd: "node", args: ["-e", "console.log('hello'); console.error('world')"] }],
    });
    expect(result.checks[0]!.stdout).toContain("hello");
    expect(result.checks[0]!.stderr).toContain("world");
  }, 15_000);

  it("handles command timeout", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [{ name: "slow", cmd: "node", args: ["-e", "setTimeout(() => {}, 60000)"], timeoutMs: 1000 }],
    });
    expect(result.checks[0]!.passed).toBe(false);
    expect(result.checks[0]!.passed).toBe(false);
  }, 10_000);

  it("handles nonexistent command gracefully", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(process.cwd(), {
      commands: [{ name: "missing", cmd: "nonexistent-command-xyz", args: [] }],
    });
    expect(result.passed).toBe(false);
    expect(result.checks[0]!.passed).toBe(false);
    expect(result.checks[0]!.error).toBeTruthy();
  }, 10_000);
});
