#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { SessionManager, agentId } from "@arena/core";

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
  const m = new SessionManager();
  const s = await m.createSession({ task, agentA: agentId("agent-a"), agentB: agentId("agent-b") });
  console.log("  Session: " + s.id);
  console.log("  State: " + s.state);
  console.log("  Full orchestration in Phase 1.");
  console.log("");
});

program.parse();
