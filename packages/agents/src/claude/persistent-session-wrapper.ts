import { PersistentSession } from "@arena/pty";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELAY_SCRIPT = join(__dirname, "claude-relay.mjs");

export interface PersistentClaudeConfig {
  cwd: string;
  env?: Record<string, string>;
  claudeCommand?: string;
  timeoutMs?: number;
}

export function createPersistentClaude(config: PersistentClaudeConfig): PersistentSession {
  return new PersistentSession({
    command: "node",
    args: [RELAY_SCRIPT],
    cwd: config.cwd,
    env: {
      ...config.env,
      ARENA_CLAUDE_CMD: config.claudeCommand ?? "claude",
      ARENA_TIMEOUT: String(config.timeoutMs ?? 120_000),
    },
  });
}
