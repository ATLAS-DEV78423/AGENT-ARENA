import { CommandPolicy, CommandPolicyResult } from "./command-policy.js";
import { SecretRedactor } from "./secret-redactor.js";
import { PathValidator } from "./path-validator.js";

export type SecurityProfile = "inherit" | "restricted" | "isolated";

const RESTRICTED_ALLOW = [
  "git", "node", "npm", "npx", "pnpm", "yarn", "bun",
  "tsc", "vitest", "jest", "eslint", "prettier",
  "cat", "ls", "find", "grep", "head", "tail", "wc",
  "echo", "pwd", "mkdir", "cp", "mv", "touch",
  "python", "python3", "pip", "pip3",
  "cargo", "rustc", "go", "make", "cmake",
];

const RESTRICTED_BLOCK = ["rm", "dd", "mkfs", "format", "shutdown", "reboot"];

export interface SecurityGuardConfig {
  profile: SecurityProfile;
  cwd: string;
}

// ponytail: inherit profile allows all commands via empty override —
// upgrade to per-command audit logging if throughput matters
const INHERIT_POLICY = new CommandPolicy({ allow: [] });
INHERIT_POLICY.validate = () => ({ allowed: true });

export class SecurityGuard {
  readonly profile: SecurityProfile;
  private commandPolicy: CommandPolicy;
  private redactor: SecretRedactor;
  private pathValidator: PathValidator;

  constructor(config: SecurityGuardConfig) {
    this.profile = config.profile;

    if (config.profile === "inherit") {
      this.commandPolicy = INHERIT_POLICY;
    } else {
      this.commandPolicy = new CommandPolicy({
        allow: RESTRICTED_ALLOW,
        block: RESTRICTED_BLOCK,
      });
    }

    this.redactor = new SecretRedactor();
    this.pathValidator = new PathValidator(config.cwd);
  }

  checkCommand(cmd: string, args: string[]): CommandPolicyResult {
    return this.commandPolicy.validate(cmd, args);
  }

  redactOutput(output: string): string {
    return this.redactor.redact(output);
  }

  validatePath(path: string): boolean {
    return this.pathValidator.isValid(path);
  }
}
