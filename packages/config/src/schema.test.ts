import { describe, it, expect } from "vitest";
import { ArenaConfigSchema, DEFAULT_CONFIG } from "./schema.js";

describe("ArenaConfigSchema", () => {
  it("parses empty object to defaults", () => {
    const config = ArenaConfigSchema.parse({});
    expect(config.agents).toEqual([]);
    expect(config.debate.maxRounds).toBe(5);
    expect(config.debate.maxMinutes).toBe(20);
    expect(config.debate.maxRepeatedObjections).toBe(2);
    expect(config.verification.runTests).toBe(true);
    expect(config.verification.requireCleanReview).toBe(true);
    expect(config.workspace.strategy).toBe("worktree");
    expect(config.security.profile).toBe("inherit");
    expect(config.logging.level).toBe("info");
  });

  it("DEFAULT_CONFIG matches parse of empty object", () => {
    expect(DEFAULT_CONFIG).toEqual(ArenaConfigSchema.parse({}));
  });

  it("accepts valid agents array", () => {
    const config = ArenaConfigSchema.parse({
      agents: [{ id: "a", command: "echo", args: ["hello"] }],
    });
    expect(config.agents).toHaveLength(1);
    expect(config.agents[0]!.id).toBe("a");
    expect(config.agents[0]!.command).toBe("echo");
    expect(config.agents[0]!.args).toEqual(["hello"]);
  });

  it("defaults agent args to empty array", () => {
    const config = ArenaConfigSchema.parse({
      agents: [{ id: "a", command: "echo" }],
    });
    expect(config.agents[0]!.args).toEqual([]);
  });

  it("accepts all debate overrides", () => {
    const config = ArenaConfigSchema.parse({
      debate: { maxRounds: 10, maxMinutes: 60, maxRepeatedObjections: 5 },
    });
    expect(config.debate.maxRounds).toBe(10);
    expect(config.debate.maxMinutes).toBe(60);
    expect(config.debate.maxRepeatedObjections).toBe(5);
  });

  it("rejects maxRounds below 1", () => {
    expect(() => ArenaConfigSchema.parse({ debate: { maxRounds: 0 } })).toThrow();
  });

  it("rejects maxRounds above 20", () => {
    expect(() => ArenaConfigSchema.parse({ debate: { maxRounds: 21 } })).toThrow();
  });

  it("rejects non-integer maxRounds", () => {
    expect(() => ArenaConfigSchema.parse({ debate: { maxRounds: 1.5 } })).toThrow();
  });

  it("accepts all workspace strategies", () => {
    for (const strategy of ["direct", "worktree", "copy"] as const) {
      const config = ArenaConfigSchema.parse({ workspace: { strategy } });
      expect(config.workspace.strategy).toBe(strategy);
    }
  });

  it("rejects invalid workspace strategy", () => {
    expect(() => ArenaConfigSchema.parse({ workspace: { strategy: "invalid" } })).toThrow();
  });

  it("accepts all security profiles", () => {
    for (const profile of ["inherit", "restricted", "isolated"] as const) {
      const config = ArenaConfigSchema.parse({ security: { profile } });
      expect(config.security.profile).toBe(profile);
    }
  });

  it("accepts all logging levels", () => {
    for (const level of ["fatal", "error", "warn", "info", "debug", "trace"] as const) {
      const config = ArenaConfigSchema.parse({ logging: { level } });
      expect(config.logging.level).toBe(level);
    }
  });

  it("rejects invalid logging level", () => {
    expect(() => ArenaConfigSchema.parse({ logging: { level: "verbose" } })).toThrow();
  });

  it("accepts partial overrides", () => {
    const config = ArenaConfigSchema.parse({ debate: { maxRounds: 3 } });
    expect(config.debate.maxRounds).toBe(3);
    expect(config.debate.maxMinutes).toBe(20);
    expect(config.workspace.strategy).toBe("worktree");
  });

  it("rejects non-boolean runTests", () => {
    expect(() =>
      ArenaConfigSchema.parse({ verification: { runTests: "yes" } }),
    ).toThrow();
  });
});
