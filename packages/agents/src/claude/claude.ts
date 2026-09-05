import { execFile } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentId, agentId } from "@arena/core";
import { PersistentRelayAdapter } from "../relay-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELAY_SCRIPT = join(__dirname, "claude-relay.mjs");
const CLAUDE_COMMAND = "claude";

export class ClaudeAdapter extends PersistentRelayAdapter {
  readonly id: AgentId = agentId("claude");
  readonly name = "Claude";

  constructor(timeouts?: { timeoutMs?: number; firstCallTimeoutMs?: number }) {
    super({
      cliCommand: CLAUDE_COMMAND,
      relayScript: RELAY_SCRIPT,
      cliEnvVar: "ARENA_CLAUDE_CMD",
      notDetectedError: "Claude CLI not detected. Run 'arena doctor' to diagnose.",
      label: "Claude",
      interactive: true,
      supportsInterrupt: true,
      ...timeouts,
    });
  }

  // Fallback one-shot mode when the persistent relay cannot start
  protected runOneShot(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        CLAUDE_COMMAND,
        ["-p", prompt, "--output-format", "text"],
        {
          // One-shot mode spawns a fresh CLI per call — every call is a cold start.
          timeout: this.firstCallTimeoutMs,
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024,
        },
        (err, stdout, stderr) => {
          if (err) {
            if (stdout && stdout.trim().length > 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(stderr || String(err)));
            }
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
  }
}