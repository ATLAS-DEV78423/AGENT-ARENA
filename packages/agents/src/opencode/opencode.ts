import { exec } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentId, agentId } from "@arena/core";
import { PersistentRelayAdapter } from "../relay-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELAY_SCRIPT = join(__dirname, "opencode-relay.mjs");
const OPENCODE_COMMAND = "opencode";

export class OpenCodeAdapter extends PersistentRelayAdapter {
  readonly id: AgentId;
  readonly name: string;
  readonly model: string;

  constructor(model: string) {
    const slug = model.split("/").pop() ?? model;
    super({
      cliCommand: OPENCODE_COMMAND,
      relayScript: RELAY_SCRIPT,
      cliEnvVar: "ARENA_OPENCODE_CMD",
      relayEnv: { ARENA_MODEL: model },
      notDetectedError: "opencode not detected. Install opencode: npm i -g opencode",
      label: "OpenCode",
    });
    this.model = model;
    this.id = agentId(slug);
    this.name = slug;
  }

  // Fallback one-shot mode when the persistent relay cannot start
  protected runOneShot(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `${OPENCODE_COMMAND} run -m ${this.model} --pure --dir ${process.cwd()}`;
      const child = exec(cmd, {
        timeout: 120_000,
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      });

      child.stdin?.write(prompt);
      child.stdin?.end();

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code) => {
        const cleaned = stdout.replace(/^>.*\n+/, "").trim();
        if (cleaned.length > 0) {
          resolve(cleaned);
        } else if (code !== 0 && stderr) {
          reject(new Error(stderr.trim()));
        } else {
          resolve(stdout.trim());
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }
}