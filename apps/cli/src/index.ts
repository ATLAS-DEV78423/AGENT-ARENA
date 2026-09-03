#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agentId } from "@arena/core";
import { Orchestrator, FakeOrchestratorAdapter } from "@arena/core";
import { EventStore } from "@arena/core";
import { OpenCodeAdapter, AgentRegistry } from "@arena/agents";
import { loadConfig } from "@arena/config";

// Shared adapter construction for `run` and `resume`.
function makeAdapters(
  opts: { fake?: boolean; modelA?: string; modelB?: string },
  config: Awaited<ReturnType<typeof loadConfig>>,
): { agentA: OpenCodeAdapter | FakeOrchestratorAdapter; agentB: OpenCodeAdapter | FakeOrchestratorAdapter } {
  if (opts.fake) {
    return {
      agentA: new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A"),
      agentB: new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B"),
    };
  }
  const modelA = opts.modelA ?? config.agents[0]?.command ?? "claude";
  const modelB = opts.modelB ?? config.agents[1]?.command ?? "opencode";
  return { agentA: new OpenCodeAdapter(modelA), agentB: new OpenCodeAdapter(modelB) };
}

const program = new Command();
program
  .name("arena")
  .description("Arena - competitive AI collaboration")
  .version("0.1.0");

// ── arena doctor ──────────────────────────────────────────
program
  .command("doctor")
  .description("Diagnose environment")
  .action(() => {
    console.log("");
    console.log("Arena Environment:");
    console.log("");
    const checks = [
      { name: "Node.js", cmd: "node --version" },
      { name: "pnpm", cmd: "pnpm --version" },
      { name: "Git", cmd: "git --version" },
      { name: "OpenCode", cmd: "opencode --version" },
      { name: "Claude CLI", cmd: "claude --version" },
    ];
    for (const c of checks) {
      try {
        const v = execSync(c.cmd, { encoding: "utf-8", timeout: 5000 }).trim();
        console.log("  ✓ " + c.name + ": " + v);
      } catch {
        console.log("  ✗ " + c.name + ": not found");
      }
    }
    console.log("");
  });

// ── arena run ─────────────────────────────────────────────
program
  .command("run <task>")
  .description("Start Arena session with two AI agents")
  .option("--fake", "Use fake agents instead of real ones")
  .option("--model-a <model>", "Model for Agent A")
  .option("--model-b <model>", "Model for Agent B")
  .option("--rounds <n>", "Max rounds", "5")
  .option("--security <profile>", "Security profile: inherit, restricted, isolated")
  .option("--no-verify", "Disable verification (test/lint/typecheck)")
  .action(
    async (
      task: string,
      opts: { fake?: boolean; modelA?: string; modelB?: string; rounds: string; security?: string; verify: boolean },
    ) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);

      console.log("");
      console.log("╔══════════════════════════════════════════╗");
      console.log("║  ARENA                                   ║");
      console.log("╚══════════════════════════════════════════╝");
      console.log("");
      console.log("Task: " + task);
      console.log("Cwd:  " + cwd);
      console.log("");

      // Set up session directory
      const arenaDir = join(cwd, ".arena");
      const sessionsDir = join(arenaDir, "sessions");
      mkdirSync(sessionsDir, { recursive: true });
      const sessionId = `session-${Date.now()}`;
      const sessionDir = join(sessionsDir, sessionId);
      mkdirSync(sessionDir, { recursive: true });

      // EventStore for persistence
      const eventStore = new EventStore(sessionDir);

      const { agentA, agentB } = makeAdapters(opts, config);
      if (opts.fake) {
        console.log("Using fake agents");
      } else {
        console.log("Agent A: " + (opts.modelA ?? config.agents[0]?.command ?? "claude"));
        console.log("Agent B: " + (opts.modelB ?? config.agents[1]?.command ?? "opencode"));
      }
      console.log("");

      const maxRounds = parseInt(opts.rounds, 10) || config.debate.maxRounds;
      const securityProfile = (opts.security ?? config.security.profile) as "inherit" | "restricted" | "isolated";
      const abortController = new AbortController();

      // Graceful SIGINT: abort orchestrator, let finally block clean up
      const onSigint = () => {
        console.log("\n  Interrupted — shutting down gracefully...");
        abortController.abort();
      };
      process.on("SIGINT", onSigint);

      // git worktrees need a git repo — fall back to direct otherwise.
      // The orchestrator only implements direct|worktree; "copy" behaves as direct.
      let workspaceStrategy: "direct" | "worktree" = "direct";
      if (config.workspace.strategy === "worktree") {
        try {
          execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore", timeout: 5000, cwd });
          workspaceStrategy = "worktree";
        } catch {
          console.log("  Not a git repository — using direct workspace strategy");
        }
      }
      // Only run the test gate when the project actually has a test script,
      // and use whatever package manager is available
      let hasTestScript = false;
      try {
        const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
        hasTestScript = Boolean(pkg?.scripts?.test);
      } catch {
        // no package.json — nothing to verify
      }
      const canRun = (cmd: string) => {
        try {
          execSync(cmd + " --version", { stdio: "ignore", timeout: 5000 });
          return true;
        } catch {
          return false;
        }
      };
      const runner = canRun("pnpm") ? "pnpm" : "npm";
      const verification =
        opts.verify !== false && config.verification.runTests && hasTestScript
          ? { commands: [{ name: "test", cmd: runner, args: ["test"] }] }
          : undefined;
      if (!hasTestScript && opts.verify !== false && config.verification.runTests) {
        console.log("  No test script in this project — skipping verification gate");
      }

      const orch = new Orchestrator(
        {
          task,
          cwd,
          maxRounds,
          maxMinutes: config.debate.maxMinutes,
          maxRepeatedObjections: config.debate.maxRepeatedObjections,
          verification,
          security: { profile: securityProfile },
          workspace: { strategy: workspaceStrategy },
          signal: abortController.signal,
          onLog: (msg) => console.log("  " + msg),
        },
        agentA,
        agentB,
        undefined,
        eventStore,
      );

      const result = await orch.run();
      process.off("SIGINT", onSigint);

      // Save session result (preserved even on interrupt)
      const interrupted = abortController.signal.aborted;
      writeFileSync(
        join(sessionDir, "result.json"),
        JSON.stringify(
          {
            sessionId: result.sessionId,
            outcome: result.outcome,
            state: result.state,
            rounds: result.rounds,
            task,
            timestamp: new Date().toISOString(),
            ...(interrupted ? { interrupted: true } : {}),
          },
          null,
          2,
        ),
      );

      console.log("");
      if (interrupted) {
        console.log("Session interrupted. Events preserved in:");
        console.log("  " + sessionDir);
        console.log("");
      }
      console.log("╔══════════════════════════════════════════╗");
      console.log("║  RESULT                                  ║");
      console.log("╠══════════════════════════════════════════╣");
      console.log("║  Outcome:  " + result.outcome.padEnd(29) + "║");
      console.log("║  Rounds:   " + String(result.rounds).padEnd(29) + "║");
      console.log("║  State:    " + result.state.padEnd(29) + "║");
      console.log("║  Session:  " + sessionId.padEnd(29) + "║");
      console.log("╚══════════════════════════════════════════╝");
      console.log("");
    },
  );

// ── arena agents ──────────────────────────────────────────
program
  .command("agents")
  .description("List detected agent adapters")
  .action(async () => {
    console.log("");
    console.log("Detected Agents:");
    console.log("");
    const registry = new AgentRegistry();
    registry.register(
      new OpenCodeAdapter("opencode/nemotron-3.5-lightning-free"),
    );
    registry.register(new OpenCodeAdapter("opencode/mimo-v2.5-free"));
    const entries = await registry.detectAll();
    if (entries.length === 0) {
      console.log("  No agents registered.");
    } else {
      for (const e of entries) {
        const status = e.detected ? "detected" : "not detected";
        console.log(
          "  " + e.adapter.id + " — " + e.adapter.name + " [" + status + "]",
        );
      }
    }
    console.log("");
  });

// ── arena sessions ────────────────────────────────────────
program
  .command("sessions")
  .description("List past sessions")
  .action(() => {
    const sessionsDir = join(process.cwd(), ".arena", "sessions");
    if (!existsSync(sessionsDir)) {
      console.log("No sessions found.");
      return;
    }
    const dirs = readdirSync(sessionsDir).filter((d) =>
      d.startsWith("session-"),
    );
    if (dirs.length === 0) {
      console.log("No sessions found.");
      return;
    }
    console.log("");
    console.log("Sessions:");
    console.log("");
    for (const d of dirs.sort().reverse()) {
      const resultPath = join(sessionsDir, d, "result.json");
      if (existsSync(resultPath)) {
        const result = JSON.parse(readFileSync(resultPath, "utf-8"));
        console.log(
          "  " +
            d +
            "  " +
            (result.outcome ?? "unknown") +
            "  rounds=" +
            (result.rounds ?? "?") +
            "  " +
            (result.task ?? "").slice(0, 40),
        );
      } else {
        console.log("  " + d + "  (in progress)");
      }
    }
    console.log("");
  });

// ── arena resume ────────────────────────────────────────
program
  .command("resume <session-id>")
  .description("Resume a timed-out or failed session")
  .option("--fake", "Use fake agents")
  .option("--rounds <n>", "Max rounds", "5")
  .action(async (sessionId: string, opts: { fake?: boolean; rounds: string }) => {
    const cwd = process.cwd();
    const sessionDir = join(cwd, ".arena", "sessions", sessionId);
    if (!existsSync(sessionDir)) {
      console.log("Session not found: " + sessionId);
      return;
    }
    const resultPath = join(sessionDir, "result.json");
    if (!existsSync(resultPath)) {
      console.log("Session is still in progress (no result.json). Nothing to resume.");
      return;
    }
    const prev = JSON.parse(readFileSync(resultPath, "utf-8"));
    console.log("");
    console.log("Resuming session: " + sessionId);
    console.log("Previous outcome: " + prev.outcome);
    console.log("Task: " + (prev.task ?? "unknown"));
    console.log("");

    // Re-run the same task with fresh agents
    const config = await loadConfig(cwd);
    const eventStore = new EventStore(sessionDir);

    const { agentA, agentB } = makeAdapters({ fake: opts.fake }, config);

    const maxRounds = parseInt(opts.rounds, 10) || config.debate.maxRounds;
    const orch = new Orchestrator(
      {
        task: prev.task,
        cwd,
        maxRounds,
        maxMinutes: config.debate.maxMinutes,
        maxRepeatedObjections: config.debate.maxRepeatedObjections,
        onLog: (msg) => console.log("  " + msg),
      },
      agentA,
      agentB,
      undefined,
      eventStore,
    );
    const result = await orch.run();

    // Overwrite result.json
    writeFileSync(
      resultPath,
      JSON.stringify(
        {
          sessionId: result.sessionId,
          outcome: result.outcome,
          state: result.state,
          rounds: result.rounds,
          task: prev.task,
          timestamp: new Date().toISOString(),
          resumedFrom: sessionId,
        },
        null,
        2,
      ),
    );

    console.log("");
    console.log("Outcome: " + result.outcome + " | Rounds: " + result.rounds + " | State: " + result.state);
    console.log("");
  });

// ── arena inspect ─────────────────────────────────────────
program
  .command("inspect <session-id>")
  .description("Inspect a past session")
  .action((sessionId: string) => {
    const sessionDir = join(
      process.cwd(),
      ".arena",
      "sessions",
      sessionId,
    );
    if (!existsSync(sessionDir)) {
      console.log("Session not found: " + sessionId);
      return;
    }
    const resultPath = join(sessionDir, "result.json");
    if (existsSync(resultPath)) {
      const result = JSON.parse(readFileSync(resultPath, "utf-8"));
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Session in progress (no result yet).");
    }
    // Show events
    const eventFiles = readdirSync(sessionDir).filter((f) =>
      f.endsWith(".jsonl"),
    );
    for (const f of eventFiles) {
      const content = readFileSync(join(sessionDir, f), "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      console.log("");
      console.log("Events (" + lines.length + "):");
      for (const line of lines) {
        const event = JSON.parse(line);
        console.log("  " + event.type + " " + event.state);
      }
    }
  });

program.parse();
