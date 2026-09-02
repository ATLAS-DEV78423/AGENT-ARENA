import { normalize } from "node:path";

const SHELL_META = /[;&|`$(){}!<>]/;

export interface CommandPolicyConfig {
  allow: string[];
  block?: string[];
}

export interface CommandPolicyResult {
  allowed: boolean;
  reason?: string;
}

export class CommandPolicy {
  private allow: Set<string>;
  private block: Set<string>;

  constructor(config: CommandPolicyConfig) {
    this.allow = new Set(config.allow.map((c) => normalize(c)));
    this.block = new Set((config.block ?? []).map((c) => normalize(c)));
  }

  validate(command: string, args: string[]): CommandPolicyResult {
    const base = normalize(command.trim().split(/\s+/)[0] ?? "");

    if (this.block.has(base)) {
      return { allowed: false, reason: `Command '${base}' is blocked` };
    }

    if (!this.allow.has(base)) {
      return { allowed: false, reason: `Command '${base}' is not in the allowlist` };
    }

    for (const arg of args) {
      if (SHELL_META.test(arg)) {
        return {
          allowed: false,
          reason: `Shell metacharacter detected in argument: '${arg}'`,
        };
      }
    }

    if (command.includes("|") || command.includes(";") || command.includes("&")) {
      return { allowed: false, reason: "Shell operator detected in command" };
    }

    return { allowed: true };
  }
}
