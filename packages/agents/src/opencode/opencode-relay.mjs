#!/usr/bin/env node
// Relay script: reads prompts from stdin, runs `opencode run` per prompt,
// writes delimited responses. Prompts are framed with a sentinel line
// (ARENA_PROMPT_DELIM) because real agent prompts span many lines — without
// framing, each line would trigger its own model call.
import { exec } from "node:child_process";
import readline from "node:readline";

const DELIM = process.env.ARENA_DELIM || "__ARENA_DELIM_END__";
const PROMPT_DELIM = process.env.ARENA_PROMPT_DELIM || "__ARENA_PROMPT_END__";
const OPENCODE_CMD = process.env.ARENA_OPENCODE_CMD || "opencode";
const MODEL = process.env.ARENA_MODEL || "";
const TIMEOUT = parseInt(process.env.ARENA_TIMEOUT || "120000", 10);

const rl = readline.createInterface({ input: process.stdin });

let promptLines = [];
let pending = 0;
let stdinClosed = false;

function exitWhenIdle() {
  // Give pending stdout writes a tick to flush before exiting.
  if (pending === 0 && stdinClosed) setTimeout(() => process.exit(0), 20);
}

function runModel(prompt) {
  pending++;
  const modelArgs = MODEL ? `-m ${MODEL}` : "";
  const cmd = `${OPENCODE_CMD} run ${modelArgs} --pure --dir ${process.cwd()}`;
  const child = exec(cmd, { timeout: TIMEOUT, maxBuffer: 1024 * 1024 });

  child.stdin?.write(prompt);
  child.stdin?.end();

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d) => { stdout += d.toString(); });
  child.stderr?.on("data", (d) => { stderr += d.toString(); });

  child.on("close", () => {
    // opencode prints a banner ("\n> build · model") to stderr even headless;
    // keep stderr only as an error fallback, and strip ANSI codes either way.
    const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
    const base = stdout.trim() ? stdout : stderr;
    const cleaned = stripAnsi(base).replace(/^\s*/, "").replace(/^>.*\n+/, "").trim();
    process.stdout.write(DELIM + "\n");
    process.stdout.write(cleaned + "\n");
    process.stdout.write(DELIM + "\n");
    pending--;
    exitWhenIdle();
  });
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
