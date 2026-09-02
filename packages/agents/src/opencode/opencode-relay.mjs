#!/usr/bin/env node
import { exec } from "node:child_process";
import readline from "node:readline";

const DELIM = process.env.ARENA_DELIM || "__ARENA_DELIM_END__";
const OPENCODE_CMD = process.env.ARENA_OPENCODE_CMD || "opencode";
const MODEL = process.env.ARENA_MODEL || "";
const TIMEOUT = parseInt(process.env.ARENA_TIMEOUT || "120000", 10);

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const prompt = line.trim();
  if (!prompt) return;

  const modelArgs = MODEL ? `-m ${MODEL}` : "";
  const cmd = `${OPENCODE_CMD} run ${modelArgs} --pure --dir ${process.cwd()}`;
  const child = exec(cmd, { timeout: TIMEOUT, maxBuffer: 1024 * 1024 });

  child.stdin?.write(prompt);
  child.stdin?.end();

  let stdout = "";
  child.stdout?.on("data", (d) => { stdout += d.toString(); });
  child.stderr?.on("data", (d) => { stdout += d.toString(); });

  child.on("close", () => {
    const cleaned = stdout.replace(/^>.*\n+/, "").trim();
    process.stdout.write(DELIM + "\n");
    process.stdout.write(cleaned + "\n");
    process.stdout.write(DELIM + "\n");
  });
});

rl.on("close", () => process.exit(0));
