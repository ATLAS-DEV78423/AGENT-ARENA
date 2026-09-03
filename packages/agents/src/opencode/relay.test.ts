import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The relay frames requests with a sentinel line so a multi-line prompt is
// ONE agent call, not one call per line. A fake opencode CLI records how many
// times it was invoked and echoes its stdin, so this stays hermetic.
const RELAY = join(dirname(fileURLToPath(import.meta.url)), "opencode-relay.mjs");
const PROMPT_DELIM = "__ARENA_PROMPT_END__";
const RESPONSE_DELIM = "__ARENA_DELIM_END__";

function writeFakeOpenCode(dir: string): string {
  const counter = join(dir, "calls.txt");
  const fake = join(dir, "fake-opencode.sh");
  writeFileSync(
    fake,
    [
      "#!/bin/sh",
      `n=$(cat "${counter}" 2>/dev/null || echo 0)`,
      `echo $((n + 1)) > "${counter}"`,
      "cat",
      "",
    ].join("\n"),
  );
  chmodSync(fake, 0o755);
  return fake;
}

function runRelay(
  prompt: string,
  dir: string,
): Promise<{ stdout: string; invocations: number }> {
  return new Promise((resolve, reject) => {
    const counter = join(dir, "calls.txt");
    const fake = writeFakeOpenCode(dir);

    const child = spawn("node", [RELAY], {
      env: { ...process.env, ARENA_OPENCODE_CMD: fake },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.on("error", reject);
    child.on("exit", () => {
      const raw = readFileSync(counter, "utf-8").trim();
      resolve({ stdout, invocations: raw ? Number(raw) : 0 });
    });
    child.stdin?.write(`${prompt}\n${PROMPT_DELIM}\n`);
    child.stdin?.end();
  });
}

function responses(stdout: string): string[] {
  return stdout
    .split(RESPONSE_DELIM)
    .filter((_, i) => i % 2 === 1)
    .map((part) => part.trim())
    .filter(Boolean);
}

describe("opencode relay framing", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("treats a multi-line prompt as one agent call and returns it whole", async () => {
    const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
    dirs.push(dir);
    const prompt = "line one\nline two\n\nline four";

    const { stdout, invocations } = await runRelay(prompt, dir);

    expect(invocations).toBe(1);
    expect(responses(stdout)).toEqual([prompt]);
  });

  it("fires on the next sentinel after a previous call finished", async () => {
    const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
    dirs.push(dir);
    const child = spawn("node", [RELAY], {
      env: { ...process.env, ARENA_OPENCODE_CMD: writeFakeOpenCode(dir) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stdout += d.toString(); });
    const exit = new Promise<void>((res) => child.on("exit", () => res()));
    child.stdin?.write(`first prompt\n${PROMPT_DELIM}\n`);
    child.stdin?.write(`second prompt\n${PROMPT_DELIM}\n`);
    child.stdin?.end();
    await exit;

    expect(responses(stdout)).toEqual(["first prompt", "second prompt"]);
  });
});
