#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { agentId } from "@arena/core";
import { Orchestrator, FakeOrchestratorAdapter } from "@arena/core";

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
    { name: "Claude CLI", cmd: "claude --version" },
  ];
  for (const c of checks) {
    try { const v = execSync(c.cmd, { encoding: "utf-8", timeout: 5000 }).trim(); console.log("  ok " + c.name + ": " + v); }
    catch { console.log("  -- " + c.name + ": not found"); }
  }
  console.log("");
});

program.command("run <task>").description("Start Arena session").action(async (task: string) => {
  console.log("");
  console.log("Arena: " + task);
  console.log("");
  const agentA = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
  const agentB = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
  const orch = new Orchestrator({ task, cwd: process.cwd() }, agentA, agentB);
  const result = await orch.run();
  console.log("");
  console.log("Outcome: " + result.outcome);
  console.log("Rounds: " + result.rounds);
  console.log("Final state: " + result.state);
  console.log("Events: " + result.events.length);
  console.log("");
});

program.parse();
