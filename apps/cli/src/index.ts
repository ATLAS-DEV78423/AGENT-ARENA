#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { agentId } from "@arena/core";
import { Orchestrator, FakeOrchestratorAdapter } from "@arena/core";
import { OpenCodeAdapter } from "@arena/agents";

const program = new Command();
program.name("arena").description("Arena - competitive AI collaboration").version("0.1.0");

program.command("doctor").description("Diagnose environment").action(() => {
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
    try { const v = execSync(c.cmd, { encoding: "utf-8", timeout: 5000 }).trim(); console.log("  ok " + c.name + ": " + v); }
    catch { console.log("  -- " + c.name + ": not found"); }
  }
  console.log("");
});

program.command("run <task>").description("Start Arena session with two AI agents")
  .option("--fake", "Use fake agents instead of real ones")
  .option("--model-a <model>", "Model for Agent A", "opencode/nemotron-3.5-lightning-free")
  .option("--model-b <model>", "Model for Agent B", "opencode/mimo-v2.5-free")
  .action(async (task: string, opts: { fake?: boolean; modelA: string; modelB: string }) => {
  console.log("");
  console.log("Arena: " + task);
  console.log("");

  let agentA, agentB;
  if (opts.fake) {
    agentA = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    agentB = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
    console.log("Using fake agents");
  } else {
    agentA = new OpenCodeAdapter(opts.modelA);
    agentB = new OpenCodeAdapter(opts.modelB);
    console.log("Agent A: " + opts.modelA);
    console.log("Agent B: " + opts.modelB);
  }
  console.log("");

  const orch = new Orchestrator({ task, cwd: process.cwd(), maxRounds: 2 }, agentA, agentB);
  const result = await orch.run();
  console.log("");
  console.log("=== ARENA RESULT ===");
  console.log("Outcome: " + result.outcome);
  console.log("Rounds: " + result.rounds);
  console.log("Final state: " + result.state);
  console.log("Events: " + result.events.length);
  console.log("");
});

program.parse();
