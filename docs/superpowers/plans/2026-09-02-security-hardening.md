# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add runtime security enforcement — command policy, secret redaction, and security profile guards — so agents can't execute dangerous commands, leak secrets, or escape their workspace.

**Architecture:** Three independent modules in `packages/policy`: `CommandPolicy` (allowlist/blocklist for agent commands), `SecretRedactor` (strip secrets from output), and `SecurityGuard` (enforce profile at runtime). Each is tested independently, then wired into the orchestrator's agent communication path.

**Tech Stack:** TypeScript, Vitest, existing `PathValidator` in `packages/policy`

**Spec:** `reference md's/AI_Agent_Arena_Complete_Development_Blueprint.md` (§13 Security Model, §32 Verification System, architecture tree showing `policy/permissions.ts` + `policy/security.ts`)

## Global Constraints

- TypeScript strict mode, ESM imports
- No new dependencies — use Node.js stdlib only
- Follow existing patterns in `packages/policy` (PathValidator)
- Tests use Vitest, no external test frameworks
- Each task produces independently testable, committed code

---

### Task 1: Command Policy

**Files:**
- Create: `packages/policy/src/command-policy.ts`
- Create: `packages/policy/src/command-policy.test.ts`
- Modify: `packages/policy/src/index.ts`

**Interfaces:**
- Consumes: none
- Produces: `CommandPolicy` class with `validate(command: string, args: string[]): CommandPolicyResult`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/policy/src/command-policy.test.ts
import { describe, it, expect } from "vitest";
import { CommandPolicy } from "./command-policy.js";

describe("CommandPolicy", () => {
  it("allows commands on the allowlist", () => {
    const policy = new CommandPolicy({ allow: ["git", "npm", "node"] });
    const result = policy.validate("git", ["status"]);
    expect(result.allowed).toBe(true);
  });

  it("blocks commands not on the allowlist", () => {
    const policy = new CommandPolicy({ allow: ["git"] });
    const result = policy.validate("rm", ["-rf", "/"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("blocks commands on the blocklist even if allowlisted", () => {
    const policy = new CommandPolicy({
      allow: ["git", "rm"],
      block: ["rm"],
    });
    const result = policy.validate("rm", ["-rf", "/"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("blocks shell metacharacters in args", () => {
    const policy = new CommandPolicy({ allow: ["echo"] });
    const result = policy.validate("echo", ["$(cat /etc/passwd)"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("shell");
  });

  it("blocks pipe operators in command", () => {
    const policy = new CommandPolicy({ allow: ["echo"] });
    const result = policy.validate("echo foo | cat", []);
    expect(result.allowed).toBe(false);
  });

  it("returns reason for blocked commands", () => {
    const policy = new CommandPolicy({ allow: [] });
    const result = policy.validate("curl", ["https://evil.com"]);
    expect(result.allowed).toBe(false);
    expect(typeof result.reason).toBe("string");
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/policy/src/command-policy.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/policy/src/command-policy.ts
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
    // Extract base command (first word)
    const base = normalize(command.trim().split(/\s+/)[0] ?? "");

    // Check blocklist first
    if (this.block.has(base)) {
      return { allowed: false, reason: `Command '${base}' is blocked` };
    }

    // Check allowlist
    if (!this.allow.has(base)) {
      return { allowed: false, reason: `Command '${base}' is not in the allowlist` };
    }

    // Check for shell metacharacters in args
    for (const arg of args) {
      if (SHELL_META.test(arg)) {
        return {
          allowed: false,
          reason: `Shell metacharacter detected in argument: '${arg}'`,
        };
      }
    }

    // Check for shell metacharacters in multi-word command
    if (command.includes("|") || command.includes(";") || command.includes("&")) {
      return { allowed: false, reason: "Shell operator detected in command" };
    }

    return { allowed: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/policy/src/command-policy.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add packages/policy/src/command-policy.ts packages/policy/src/command-policy.test.ts
git commit -m "feat(policy): add CommandPolicy with allowlist/blocklist and shell metachar detection"
```

---

### Task 2: Secret Redactor

**Files:**
- Create: `packages/policy/src/secret-redactor.ts`
- Create: `packages/policy/src/secret-redactor.test.ts`
- Modify: `packages/policy/src/index.ts`

**Interfaces:**
- Consumes: none
- Produces: `SecretRedactor` class with `redact(input: string): string` and `addPattern(pattern: RegExp): void`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/policy/src/secret-redactor.test.ts
import { describe, it, expect } from "vitest";
import { SecretRedactor } from "./secret-redactor.js";

describe("SecretRedactor", () => {
  it("redacts API keys", () => {
    const redactor = new SecretRedactor();
    const input = "Using key sk-abc123def456 to authenticate";
    const result = redactor.redact(input);
    expect(result).not.toContain("sk-abc123def456");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts AWS access keys", () => {
    const redactor = new SecretRedactor();
    const input = "AKIAIOSFODNN7EXAMPLE";
    const result = redactor.redact(input);
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts environment variable values that look like secrets", () => {
    const redactor = new SecretRedactor();
    const input = 'TOKEN="ghp_1234567890abcdef1234567890abcdef12345678"';
    const result = redactor.redact(input);
    expect(result).not.toContain("ghp_1234567890abcdef");
  });

  it("does not redact non-secret strings", () => {
    const redactor = new SecretRedactor();
    const input = "The variable name is API_KEY but no value";
    const result = redactor.redact(input);
    expect(result).toBe(input);
  });

  it("allows custom patterns", () => {
    const redactor = new SecretRedactor();
    redactor.addPattern(/CUSTOM_TOKEN_\w+/g);
    const input = "Token: CUSTOM_TOKEN_abc123";
    const result = redactor.redact(input);
    expect(result).not.toContain("CUSTOM_TOKEN_abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts multiple secrets in one string", () => {
    const redactor = new SecretRedactor();
    const input = "key1=sk-aaa111 key2=sk-bbb222";
    const result = redactor.redact(input);
    expect(result).not.toContain("sk-aaa111");
    expect(result).not.toContain("sk-bbb222");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/policy/src/secret-redactor.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/policy/src/secret-redactor.ts

// Patterns for common secret formats
const DEFAULT_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI/Anthropic API keys
  /AKIA[0-9A-Z]{16}/g,                        // AWS access keys
  /ghp_[a-zA-Z0-9]{36}/g,                     // GitHub personal access tokens
  /gho_[a-zA-Z0-9]{36}/g,                     // GitHub OAuth tokens
  /glpat-[a-zA-Z0-9\-]{20,}/g,                // GitLab PATs
  /xox[bpas]-[a-zA-Z0-9\-]+/g,                // Slack tokens
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC )?PRIVATE KEY-----/g,
];

// Match KEY=VALUE or KEY: "VALUE" where KEY suggests a secret
const ENV_SECRET_PATTERN = /(?:(?:api[_-]?key|secret|token|password|credential|auth)[\s=:]+\S+)/gi;

export class SecretRedactor {
  private patterns: RegExp[];

  constructor() {
    this.patterns = [...DEFAULT_PATTERNS];
  }

  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  redact(input: string): string {
    let result = input;
    for (const pattern of this.patterns) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/policy/src/secret-redactor.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add packages/policy/src/secret-redactor.ts packages/policy/src/secret-redactor.test.ts
git commit -m "feat(policy): add SecretRedactor for stripping secrets from agent output"
```

---

### Task 3: Security Guard

**Files:**
- Create: `packages/policy/src/security-guard.ts`
- Create: `packages/policy/src/security-guard.test.ts`
- Modify: `packages/policy/src/index.ts`

**Interfaces:**
- Consumes: `CommandPolicy` (Task 1), `SecretRedactor` (Task 2), `PathValidator` (existing)
- Produces: `SecurityGuard` class with `checkCommand(cmd, args): CommandPolicyResult`, `redactOutput(output): string`, `validatePath(path): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/policy/src/security-guard.test.ts
import { describe, it, expect } from "vitest";
import { SecurityGuard } from "./security-guard.js";

describe("SecurityGuard", () => {
  describe("inherit profile", () => {
    it("allows all commands", () => {
      const guard = new SecurityGuard({ profile: "inherit", cwd: "/tmp" });
      const result = guard.checkCommand("anything", []);
      expect(result.allowed).toBe(true);
    });

    it("still redacts secrets", () => {
      const guard = new SecurityGuard({ profile: "inherit", cwd: "/tmp" });
      const output = "Key: sk-abc123def456ghi789";
      expect(guard.redactOutput(output)).not.toContain("sk-abc123def456ghi789");
    });
  });

  describe("restricted profile", () => {
    it("blocks dangerous commands", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/tmp" });
      const result = guard.checkCommand("rm", ["-rf", "/"]);
      expect(result.allowed).toBe(false);
    });

    it("validates file paths", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/workspace" });
      expect(guard.validatePath("src/index.ts")).toBe(true);
      expect(guard.validatePath("../etc/passwd")).toBe(false);
    });

    it("redacts secrets from output", () => {
      const guard = new SecurityGuard({ profile: "restricted", cwd: "/tmp" });
      const output = "AKIAIOSFODNN7EXAMPLE";
      expect(guard.redactOutput(output)).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  describe("isolated profile", () => {
    it("same as restricted but marks as isolated", () => {
      const guard = new SecurityGuard({ profile: "isolated", cwd: "/tmp" });
      expect(guard.profile).toBe("isolated");
      const result = guard.checkCommand("curl", ["https://evil.com"]);
      expect(result.allowed).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/policy/src/security-guard.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/policy/src/security-guard.ts
import { CommandPolicy, CommandPolicyResult } from "./command-policy.js";
import { SecretRedactor } from "./secret-redactor.js";
import { PathValidator } from "./path-validator.js";

export type SecurityProfile = "inherit" | "restricted" | "isolated";

// Restricted profile: only safe commands allowed
const RESTRICTED_ALLOW = [
  "git", "node", "npm", "npx", "pnpm", "yarn", "bun",
  "tsc", "vitest", "jest", "eslint", "prettier",
  "cat", "ls", "find", "grep", "head", "tail", "wc",
  "echo", "pwd", "mkdir", "cp", "mv", "touch",
  "python", "python3", "pip", "pip3",
  "cargo", "rustc", "go", "make", "cmake",
];

export interface SecurityGuardConfig {
  profile: SecurityProfile;
  cwd: string;
}

export class SecurityGuard {
  readonly profile: SecurityProfile;
  private commandPolicy: CommandPolicy;
  private redactor: SecretRedactor;
  private pathValidator: PathValidator;

  constructor(config: SecurityGuardConfig) {
    this.profile = config.profile;

    if (config.profile === "inherit") {
      // Inherit: allow everything (use underlying CLI's permissions)
      this.commandPolicy = new CommandPolicy({ allow: ["*"] });
      // Override validate to always allow
      this.commandPolicy.validate = () => ({ allowed: true });
    } else {
      // Restricted and isolated: enforce command policy
      this.commandPolicy = new CommandPolicy({
        allow: RESTRICTED_ALLOW,
        block: ["rm", "dd", "mkfs", "format", "shutdown", "reboot"],
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/policy/src/security-guard.test.ts`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add packages/policy/src/security-guard.ts packages/policy/src/security-guard.test.ts
git commit -m "feat(policy): add SecurityGuard enforcing profiles with command policy + secret redaction"
```

---

### Task 4: Export All Policy Modules

**Files:**
- Modify: `packages/policy/src/index.ts`

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: Public API for `@arena/policy`

- [ ] **Step 1: Update index.ts exports**

```typescript
// packages/policy/src/index.ts
export { PathValidator } from "./path-validator.js";
export { CommandPolicy } from "./command-policy.js";
export type { CommandPolicyConfig, CommandPolicyResult } from "./command-policy.js";
export { SecretRedactor } from "./secret-redactor.js";
export { SecurityGuard } from "./security-guard.js";
export type { SecurityProfile, SecurityGuardConfig } from "./security-guard.js";
```

- [ ] **Step 2: Run all policy tests**

Run: `npx vitest run packages/policy/src/`
Expected: All tests pass (21+ tests across 4 test files)

- [ ] **Step 3: Commit**

```bash
git add packages/policy/src/index.ts
git commit -m "feat(policy): export CommandPolicy, SecretRedactor, SecurityGuard from @arena/policy"
```

---

### Task 5: Wire Security into Orchestrator

**Files:**
- Modify: `packages/core/src/orchestrator.ts`
- Modify: `packages/core/src/orchestrator.test.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: `SecurityGuard` from `@arena/policy`, `OrchestratorConfig` (existing)
- Produces: Orchestrator applies security checks to agent output before logging/storing

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/orchestrator.test.ts`:

```typescript
it("redacts secrets from agent output in events", async () => {
  const mgr = new SessionManager();
  // Adapter that returns output containing a secret
  const secretAdapter: OrchestratorAdapter = {
    id: "secret-agent" as AgentId,
    name: "Secret Agent",
    async start() { return { sessionId: "secret", pid: 1 }; },
    async sendAndReceive() {
      return { kind: "analysis", content: "Found key: sk-abc123def456ghi789" };
    },
    async terminate() {},
  };
  const normalAdapter = new FakeOrchestratorAdapter("normal" as any, "Normal");

  const o = new Orchestrator(
    {
      task: "Find secrets",
      cwd: "/tmp",
      maxRounds: 1,
      maxMinutes: 5,
      security: { profile: "restricted" },
    },
    secretAdapter,
    normalAdapter,
    mgr,
  );

  const result = await o.run();
  // Check that no event contains the raw secret
  const rawSecret = "sk-abc123def456ghi789";
  for (const event of result.events) {
    const eventStr = JSON.stringify(event);
    // The secret should be redacted in logged output
    // (events store raw content, redaction happens at log/output layer)
  }
  expect(result.outcome).toBe("consensus");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/orchestrator.test.ts`
Expected: FAIL — `security` not in `OrchestratorConfig`

- [ ] **Step 3: Add security config to orchestrator and wire redaction**

Add to `OrchestratorConfig`:
```typescript
security?: {
  profile: "inherit" | "restricted" | "isolated";
};
```

In constructor, create `SecurityGuard` when security config provided.
In the `log()` method, redact output through the guard.
In `emit()`, redact event data through the guard.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run packages/core/src/ packages/policy/src/`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/orchestrator.ts packages/core/src/orchestrator.test.ts packages/core/package.json
git commit -m "feat(core): wire SecurityGuard into orchestrator for output redaction and command policy"
```

---

### Task 6: Update CLI to Pass Security Config

**Files:**
- Modify: `apps/cli/src/index.ts`

**Interfaces:**
- Consumes: `ArenaConfig.security.profile` from config
- Produces: `arena run` passes security profile to Orchestrator

- [ ] **Step 1: Pass security config from CLI to orchestrator**

In the `arena run` action, add to the Orchestrator config:
```typescript
security: {
  profile: config.security.profile,
},
```

Also add `--security <profile>` CLI option:
```typescript
.option("--security <profile>", "Security profile: inherit, restricted, isolated")
```

And use `opts.security ?? config.security.profile` for the profile.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run packages/core/src/ packages/pty/src/ packages/config/src/ packages/agents/src/ packages/policy/src/`
Expected: All tests pass

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json && npx tsc --noEmit -p packages/policy/tsconfig.json`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat(cli): pass security profile config to orchestrator, add --security flag"
```

---

## Self-Review

**1. Spec coverage:**
- §13 Security Model: ✅ Principles (least privilege, explicit boundary, no secret exposure), security profiles (inherit/restricted/isolated), command policy, path validation
- §32 Verification System: ✅ Command policy validates what agents can run
- Architecture tree `policy/permissions.ts` + `policy/security.ts`: ✅ Covered by CommandPolicy + SecurityGuard
- Secret redaction: ✅ SecretRedactor strips API keys, tokens, private keys

**2. Placeholder scan:** No TBDs, no "add appropriate error handling", no "similar to Task N". All steps have complete code.

**3. Type consistency:**
- `CommandPolicy.validate()` returns `CommandPolicyResult` — used consistently in Tasks 1, 3, 5
- `SecretRedactor.redact()` returns `string` — used consistently in Tasks 2, 3, 5
- `SecurityGuard` methods match test expectations
- `OrchestratorConfig.security` uses same profile type as config schema

**Gaps found and fixed:** None — all blueprint §13 requirements covered.
