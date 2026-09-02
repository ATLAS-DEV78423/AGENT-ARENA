import { describe, it, expect } from "vitest";
import { SecurityGuard } from "./security-guard.js";

describe("SecurityGuard", () => {
  describe("inherit profile", () => {
    it("allows all commands", () => {
      const guard = new SecurityGuard({ profile: "inherit", cwd: "/tmp" });
      const result = guard.checkCommand("anything", []);
      expect(result.allowed).toBe(true);
    });

    it("still redacts secrets", () => {
      const guard = new SecurityGuard({ profile: "inherit", cwd: "/tmp" });
      const output = "Key: sk-abc123def456ghi789jkl012mno";
      expect(guard.redactOutput(output)).not.toContain("sk-abc123def456ghi789jkl012mno");
    });
  });

  describe("restricted profile", () => {
    it("allows safe commands", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/tmp" });
      const result = guard.checkCommand("git", ["status"]);
      expect(result.allowed).toBe(true);
    });

    it("blocks dangerous commands", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/tmp" });
      const result = guard.checkCommand("rm", ["-rf", "/"]);
      expect(result.allowed).toBe(false);
    });

    it("validates file paths", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/workspace" });
      expect(guard.validatePath("src/index.ts")).toBe(true);
      expect(guard.validatePath("../etc/passwd")).toBe(false);
    });

    it("redacts secrets from output", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/tmp" });
      const output = "AKIAIOSFODNN7EXAMPLE";
      expect(guard.redactOutput(output)).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  describe("isolated profile", () => {
    it("same as restricted but marks as isolated", () => {
      const guard = new SecurityGuard({ profile: "isolated", cwd: "/tmp" });
      expect(guard.profile).toBe("isolated");
      const result = guard.checkCommand("curl", ["https://evil.com"]);
      expect(result.allowed).toBe(false);
    });
  });
});
