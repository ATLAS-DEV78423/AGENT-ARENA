#!/usr/bin/env node
// Relay script: reads prompts from stdin, runs `claude -p` per prompt, writes
// delimited responses. Prompts are framed with a sentinel line
// (ARENA_PROMPT_DELIM) because real agent prompts span many lines — without
// framing, each line would trigger its own model call.
import { execFile } from "node:child_process";
import readline from "node:readline";

const DELIM = process.env.ARENA_DELIM || "__ARENA_DELIM_END__";
const PROMPT_DELIM = process.env.ARENA_PROMPT_DELIM || "__ARENA_PROMPT_END__";
const CLAUDE_CMD = process.env.ARENA_CLAUDE_CMD || "claude";
// The first call on a fresh relay is a cold start (spawn + provider handshake)
// and gets its own budget; the adapter always passes both env vars, and counts
// calls the same way, so the two sides agree per call.
const TIMEOUT = parseInt(process.env.ARENA_TIMEOUT || "120000", 10);
const FIRST_CALL_TIMEOUT = parseInt(
  process.env.ARENA_FIRST_CALL_TIMEOUT || String(TIMEOUT),
  10,
);

const rl = readline.createInterface({ input: process.stdin });

let promptLines = [];
let calls = 0;
let pending = 0;
let stdinClosed = false;

function exitWhenIdle() {
  // Give pending stdout writes a tick to flush before exiting.
  if (pending === 0 && stdinClosed) setTimeout(() => process.exit(0), 20);
}

function runModel(prompt) {
  pending++;
  const timeout = calls === 0 ? FIRST_CALL_TIMEOUT : TIMEOUT;
  calls++;
  execFile(
    CLAUDE_CMD,
    ["-p", prompt, "--output-format", "text"],
    { timeout, maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
      const output = err && !stdout?.trim() ? (stderr || String(err)) : (stdout || "");
      process.stdout.write(DELIM + "\n");
      process.stdout.write(output.trim() + "\n");
      process.stdout.write(DELIM + "\n");
      pending--;
      exitWhenIdle();
    },
  );
}

rl.on("line", (line) => {
  if (line.trim() === PROMPT_DELIM) {
    const prompt = promptLines.join("\n").trim();
    promptLines = [];
    if (prompt) runModel(prompt);
    return;
  }
  promptLines.push(line);
});

rl.on("close", () => {
  stdinClosed = true;
  exitWhenIdle();
});
