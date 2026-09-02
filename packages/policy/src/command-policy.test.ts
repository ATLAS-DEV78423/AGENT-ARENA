import { describe, it, expect } from "vitest";
import { CommandPolicy } from "./command-policy.js";

describe("CommandPolicy", () => {
  it("allows commands on the allowlist", () => {
    const policy = new CommandPolicy({ allow: ["git", "npm", "node"] });
    const result = policy.validate("git", ["status"]);
    expect(result.allowed).toBe(true);
  });

  it("blocks commands not on the allowlist", () => {
    const policy = new CommandPolicy({ allow: ["git"] });
    const result = policy.validate("rm", ["-rf", "/"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in the allowlist");
  });

  it("blocks commands on the blocklist even if allowlisted", () => {
    const policy = new CommandPolicy({
      allow: ["git", "rm"],
      block: ["rm"],
    });
    const result = policy.validate("rm", ["-rf", "/"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("blocks shell metacharacters in args", () => {
    const policy = new CommandPolicy({ allow: ["echo"] });
    const result = policy.validate("echo", ["$(cat /etc/passwd)"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Shell");
  });

  it("blocks pipe operators in command", () => {
    const policy = new CommandPolicy({ allow: ["echo"] });
    const result = policy.validate("echo foo | cat", []);
    expect(result.allowed).toBe(false);
  });

  it("returns reason for blocked commands", () => {
    const policy = new CommandPolicy({ allow: [] });
    const result = policy.validate("curl", ["https://evil.com"]);
    expect(result.allowed).toBe(false);
    expect(typeof result.reason).toBe("string");
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
