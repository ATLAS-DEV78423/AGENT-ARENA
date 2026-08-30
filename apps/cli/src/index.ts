#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { SessionManager } from "@arena/core";
import { agentId } from "@arena/core";

const program = new Command();
program.name("arena").description("Arena — competitive AI collaboration").version("0.1.0");

program.command("doctor").description("Diagnose environment").action(() => {
  console.log("
Arena Environment:
");
  const checks = [
    { name: "Node.js", cmd: "node --version" },
    { name: "pnpm", cmd: "pnpm --version" },
    { name: "Git", cmd: "git --version" },
    { name: "Claude CLI", cmd: "claude --version" },
  ];
  for (const c of checks) {
    try { const v = execSync(c.cmd, { encoding: "utf-8", timeout: 5000 }).trim(); console.log("  ✓ " + c.name + ": " + v); }
    catch { console.log("  ✗ " + c.name + ": not found"); }
  }
  console.log("");
});

program.command("agents").description("List agents").action(async () => {
  const { AgentRegistry } = await import("@arena/agents");
  const reg = new AgentRegistry();
  // Auto-detect Claude
  reg.register({ id: agentId("claude"), name: "Claude",
    async detect() { try { execSync("claude --version", { encoding: "utf-8", timeout: 5000 }); return { detected: true, command: "claude" }; } catch { return { detected: false, command: "claude" }; } },
    async start() { return { sessionId: "s" as any, pid: 0 }; },
    async send() {}, async interrupt() {}, async terminate() {},
    async getStatus() { return "idle" as const; },
    async capabilities() { return { terminal: true, filesystem: true, shell: true, mcp: false, plugins: false, network: false, interactive: true, supportsInterrupt: true, supportsResume: false }; }
  });
  const results = await reg.detectAll();
  console.log("
Agents:");
  for (const { adapter, detected } of results) console.log("  " + (detected ? "✓" : "✗") + " " + adapter.name);
  console.log("");
});

program.command("run <task>").description("Start Arena session").action(async (task: string) => {
  console.log("
🎮 Arena: " + task + "
");
  const m = new SessionManager();
  const s = await m.createSession({ task, agentA: agentId("agent-a"), agentB: agentId("agent-b") });
  console.log("  Session: " + s.id);
  console.log("  State: " + s.state);
  console.log("  → Full orchestration in Phase 1.
");
});

program.parse();
