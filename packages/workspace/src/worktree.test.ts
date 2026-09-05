import { describe, it, expect, afterAll } from "vitest";
import { WorktreeManager } from "./worktree.js";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const TEST_DIR = join(process.cwd(), ".arena-worktree-test");

function setupGitRepo(): string {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  execSync("git init", { cwd: TEST_DIR, stdio: "ignore" });
  execSync("git config user.email 'test@test.com'", { cwd: TEST_DIR, stdio: "ignore" });
  execSync("git config user.name 'Test'", { cwd: TEST_DIR, stdio: "ignore" });
  execSync("touch README.md && git add . && git commit -m 'init'", { cwd: TEST_DIR, stdio: "ignore" });
  return TEST_DIR;
}

describe("WorktreeManager", () => {
  it("creates a worktree in a temporary directory", () => {
    const repo = setupGitRepo();
    const mgr = new WorktreeManager(repo);
    const wt = mgr.create("agent-a");
    expect(existsSync(wt.path)).toBe(true);
    expect(wt.branch).toContain("arena/agent-a");
    // Verify the worktree is registered by git. Full-path matching is hopeless
    // across platforms — git prints the long form (runneradmin) while wt.path
    // may carry an 8.3 short name (RUNNER~1); even realpathSync doesn't expand
    // NTFS short-name aliases. The mkdtemp leaf directory name is unique and
    // spelling-invariant, and git prints it verbatim on every platform.
    const worktrees = execSync("git worktree list", { cwd: repo, encoding: "utf-8" });
    expect(worktrees).toContain(basename(wt.path));
    mgr.cleanup(wt);
  });

  it("creates isolated worktrees for multiple agents", () => {
    const repo = setupGitRepo();
    const mgr = new WorktreeManager(repo);
    const wtA = mgr.create("agent-a");
    const wtB = mgr.create("agent-b");
    expect(wtA.path).not.toBe(wtB.path);
    expect(existsSync(wtA.path)).toBe(true);
    expect(existsSync(wtB.path)).toBe(true);
    mgr.cleanup(wtA);
    mgr.cleanup(wtB);
  });

  it("cleanup removes the worktree", () => {
    const repo = setupGitRepo();
    const mgr = new WorktreeManager(repo);
    const wt = mgr.create("agent-cleanup");
    expect(existsSync(wt.path)).toBe(true);
    mgr.cleanup(wt);
    expect(existsSync(wt.path)).toBe(false);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
