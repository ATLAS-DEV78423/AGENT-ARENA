import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "./loader.js";

describe("loadConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), "arena-config-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", async () => {
    const config = await loadConfig(dir);
    expect(config.debate.maxRounds).toBe(5);
    expect(config.debate.maxMinutes).toBe(20);
    expect(config.workspace.strategy).toBe("worktree");
  });

  it("loads .arena/config.yaml when it exists", async () => {
    const arenaDir = join(dir, ".arena");
    mkdirSync(arenaDir, { recursive: true });
    writeFileSync(
      join(arenaDir, "config.yaml"),
      "debate:\n  maxRounds: 3\n  maxMinutes: 10\n",
    );
    const config = await loadConfig(dir);
    expect(config.debate.maxRounds).toBe(3);
    expect(config.debate.maxMinutes).toBe(10);
    // Defaults preserved for unspecified fields
    expect(config.workspace.strategy).toBe("worktree");
  });

  it("loads .arena/config.json when it exists", async () => {
    const arenaDir = join(dir, ".arena");
    mkdirSync(arenaDir, { recursive: true });
    writeFileSync(
      join(arenaDir, "config.json"),
      JSON.stringify({ debate: { maxRounds: 2 } }),
    );
    const config = await loadConfig(dir);
    expect(config.debate.maxRounds).toBe(2);
  });

  it("prefers .arena/config.yaml over .arena/config.json", async () => {
    const arenaDir = join(dir, ".arena");
    mkdirSync(arenaDir, { recursive: true });
    writeFileSync(
      join(arenaDir, "config.yaml"),
      "debate:\n  maxRounds: 7\n",
    );
    writeFileSync(
      join(arenaDir, "config.json"),
      JSON.stringify({ debate: { maxRounds: 3 } }),
    );
    const config = await loadConfig(dir);
    expect(config.debate.maxRounds).toBe(7);
  });

  it("validates config through Zod schema", async () => {
    const arenaDir = join(dir, ".arena");
    mkdirSync(arenaDir, { recursive: true });
    writeFileSync(
      join(arenaDir, "config.yaml"),
      "debate:\n  maxRounds: 99\n",
    );
    await expect(loadConfig(dir)).rejects.toThrow();
  });
});
