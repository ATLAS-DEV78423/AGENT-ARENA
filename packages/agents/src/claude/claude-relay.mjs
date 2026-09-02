#!/usr/bin/env node
// Relay script: reads delimited messages from stdin, runs `claude -p`, outputs delimited responses.
// Used by PersistentSession to maintain multi-turn conversations with claude.
import { execFile } from "node:child_process";
import readline from "node:readline";

const DELIM = process.env.ARENA_DELIM || "__ARENA_DELIM_END__";
const CLAUDE_CMD = process.env.ARENA_CLAUDE_CMD || "claude";
const TIMEOUT = parseInt(process.env.ARENA_TIMEOUT || "120000", 10);

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const prompt = line.trim();
  if (!prompt) return;

  const args = ["-p", prompt, "--output-format", "text"];
  execFile(CLAUDE_CMD, args, { timeout: TIMEOUT, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    const output = err && !stdout?.trim() ? (stderr || String(err)) : (stdout || "");
    process.stdout.write(DELIM + "\n");
    process.stdout.write(output.trim() + "\n");
    process.stdout.write(DELIM + "\n");
  });
});

rl.on("close", () => process.exit(0));
