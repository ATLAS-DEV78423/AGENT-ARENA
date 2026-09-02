import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { SessionManager } from "./session/manager.js";

describe("Orchestrator worktree isolation", () => {
  it("passes cwd directly when workspace strategy is direct", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const startCalls: string[] = [];
    const origStartA = a.start.bind(a);
    const origStartB = b.start.bind(b);
    a.start = async (config) => {
      startCalls.push(config.cwd);
      return origStartA(config);
    };
    b.start = async (config) => {
      startCalls.push(config.cwd);
      return origStartB(config);
    };

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/test/project",
        maxRounds: 1,
        maxMinutes: 5,
      },
      a,
      b,
      mgr,
    );

    await o.run();
    // Both agents should receive the original cwd
    expect(startCalls[0]).toBe("/test/project");
    expect(startCalls[1]).toBe("/test/project");
  });

  it("creates worktrees per agent when workspace strategy is worktree", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    const startCwds: string[] = [];
    const origStartA = a.start.bind(a);
    const origStartB = b.start.bind(b);
    a.start = async (config) => {
      startCwds.push(config.cwd);
      return origStartA(config);
    };
    b.start = async (config) => {
      startCwds.push(config.cwd);
      return origStartB(config);
    };

    // Mock WorktreeManager
    let createdWorktrees: string[] = [];
    let cleanedWorktrees: string[] = [];
    const mockWorktreeManager = {
      create: vi.fn((id: string) => {
        const path = `/tmp/arena-wt-${id}`;
        createdWorktrees.push(path);
        return { path, branch: `arena/${id}-test` };
      }),
      cleanup: vi.fn((wt: { path: string }) => {
        cleanedWorktrees.push(wt.path);
      }),
    };

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/test/project",
        maxRounds: 1,
        maxMinutes: 5,
        workspace: { strategy: "worktree" },
      },
      a,
      b,
      mgr,
    );

    // Inject mock worktree manager
    (o as any).worktreeManager = mockWorktreeManager;

    await o.run();

    // Should have created 2 worktrees
    expect(mockWorktreeManager.create).toHaveBeenCalledTimes(2);

    // Agents should receive worktree paths, not original cwd
    expect(startCwds[0]).toBe("/tmp/arena-wt-agent-a");
    expect(startCwds[1]).toBe("/tmp/arena-wt-agent-b");

    // Worktrees should be cleaned up
    expect(cleanedWorktrees).toHaveLength(2);
  });

  it("cleans up worktrees on error", async () => {
    const mgr = new SessionManager();
    const a = new FakeOrchestratorAdapter("agent-a" as any, "Agent A");
    const b = new FakeOrchestratorAdapter("agent-b" as any, "Agent B");

    let cleanedWorktrees: string[] = [];
    const mockWorktreeManager = {
      create: vi.fn((id: string) => ({
        path: `/tmp/arena-wt-${id}`,
        branch: `arena/${id}-test`,
      })),
      cleanup: vi.fn((wt: { path: string }) => {
        cleanedWorktrees.push(wt.path);
      }),
    };

    const o = new Orchestrator(
      {
        task: "Build a login form",
        cwd: "/test/project",
        maxRounds: 1,
        maxMinutes: 5,
        workspace: { strategy: "worktree" },
      },
      a,
      b,
      mgr,
    );

    (o as any).worktreeManager = mockWorktreeManager;

    // Make adapter A throw during analysis
    a.sendAndReceive = async () => {
      throw new Error("Agent crashed");
    };

    await o.run();

    // Worktrees should still be cleaned up even on error
    expect(cleanedWorktrees).toHaveLength(2);
  });
});
