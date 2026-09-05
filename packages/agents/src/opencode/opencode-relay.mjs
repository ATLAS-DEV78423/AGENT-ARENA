#!/usr/bin/env node
// Relay script: reads prompts from stdin, runs `opencode run` per prompt,
// writes delimited responses. Prompts are framed with a sentinel line
// (ARENA_PROMPT_DELIM) because real agent prompts span many lines — without
// framing, each line would trigger its own model call.
import { execFile } from "node:child_process";
import readline from "node:readline";

const DELIM = process.env.ARENA_DELIM || "__ARENA_DELIM_END__";
const PROMPT_DELIM = process.env.ARENA_PROMPT_DELIM || "__ARENA_PROMPT_END__";
const OPENCODE_CMD = process.env.ARENA_OPENCODE_CMD || "opencode";
const MODEL = process.env.ARENA_MODEL || "";
const TIMEOUT = parseInt(process.env.ARENA_TIMEOUT || "120000", 10);
// The first call on a fresh relay is a cold start (spawn + provider handshake)
// and gets its own budget; the adapter always passes both env vars, and counts
// calls the same way, so the two sides agree per call.
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
  // execFile with an args array (no shell string). On win32 a command
  // that isn't a real executable (an npm .cmd shim or a shell script —
  // what ARENA_OPENCODE_CMD points at in tests) can't be spawned
  // directly; exec()'s string form resolves scripts through file
  // association to git-bash.exe, which detaches stdio and hangs until
  // the timeout kills it. Bridge through sh instead.
  const modelArgs = MODEL ? ["-m", MODEL] : [];
  const args = [...modelArgs, "run", "--pure", "--dir", process.cwd()];
  const onWindows = process.platform === "win32";
  const looksLikeScript = /\.(cmd|bat|sh|ps1)$/i.test(OPENCODE_CMD) || !/\.(exe)?$/i.test(OPENCODE_CMD);
  const [cmd, cmdArgs] = onWindows && looksLikeScript ? ["sh", [OPENCODE_CMD, ...args]] : [OPENCODE_CMD, args];

  const child = execFile(
    cmd,
    cmdArgs,
    { timeout, maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
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
    },
  );

  child.stdin?.write(prompt);
  child.stdin?.end();
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
