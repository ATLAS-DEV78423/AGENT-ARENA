# Arena Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Arena's foundational infrastructure — monorepo scaffold, core types, state machine, protocol schemas, agent adapter interface, PTY engine, fake-agent harness, configuration system, CLI skeleton, and logging — such that a fake-agent session can complete a full ANALYSIS→DISCUSSION→PLAN→APPROVAL→BUILD→REVIEW→ROLE_SWITCH cycle without any real AI model.

**Architecture:** pnpm monorepo with workspace packages. Core runtime controls state transitions deterministically. Protocol layer validates all events with Zod. Agent adapters communicate through PTY or child_process. Fake-agent harness provides scripted behavior for CI/testing. CLI provides entry points.

**Tech Stack:** TypeScript (strict), Node.js, pnpm, Zod, Vitest, ESLint, Prettier, Pino, node-pty (with child_process fallback), Commander.js

**Spec:** `reference md's/AI_Agent_Arena_Complete_Development_Blueprint.md`

---

## File Structure

### Root Config Files
| File | Responsibility |
|------|---------------|
| `package.json` | Root workspace package with scripts |
| `pnpm-workspace.yaml` | Monorepo package declarations |
| `tsconfig.base.json` | Shared TypeScript strict config |
| `vitest.config.ts` | Root Vitest configuration |
| `.prettierrc` | Formatting rules |
| `eslint.config.js` | Linting rules |
| `.gitignore` | Git ignore patterns |
| `README.md` | Project overview and quickstart |
| `AGENTS.md` | Engineering instructions for AI coding agents |

### `packages/core/src/`
| File | Responsibility |
|------|---------------|
| `index.ts` | Public exports |
| `types/state-machine.ts` | Arena state definitions and transition tables |
| `types/protocol.ts` | Protocol event type definitions |
| `types/agent.ts` | Agent identity, capabilities, status types |
| `types/session.ts` | Session, round, approval, finding types |
| `types/common.ts` | Shared primitives (timestamps, IDs, errors) |
| `state-machine.ts` | Deterministic state machine implementation |
| `protocol/schemas.ts` | Zod schemas for all protocol events |
| `protocol/events.ts` | Event store (JSONL append/read/validate) |
| `errors/codes.ts` | Error code enum and helpers |
| `errors/arena-error.ts` | Structured ArenaError class |
| `session/manager.ts` | Session lifecycle orchestrator |
| `session/budget.ts` | Round/turn/tool-call budget enforcement |

### `packages/agents/src/`
| File | Responsibility |
|------|---------------|
| `adapter.ts` | AgentAdapter interface |
| `registry.ts` | Adapter registry and discovery |
| `fake/adapter.ts` | Fake agent adapter (scripted behavior) |
| `fake/scenarios.ts` | Pre-built test scenarios |
| `capabilities.ts` | Capability detection and profiles |

### `packages/pty/src/`
| File | Responsibility |
|------|---------------|
| `manager.ts` | PTY process pool manager |
| `session.ts` | Individual PTY session wrapper |
| `stream.ts` | Output capture and parsing |

### `packages/workspace/src/`
| File | Responsibility |
|------|---------------|
| `git.ts` | Git integration (status, worktree, branches) |
| `detector.ts` | Repository root and dirty-state detection |

### `packages/policy/src/`
| File | Responsibility |
|------|---------------|
| `path-validator.ts` | Workspace boundary and traversal validation |

### `packages/config/src/`
| File | Responsibility |
|------|---------------|
| `schema.ts` | Zod configuration schema |
| `loader.ts` | Config file discovery and loading |

### `packages/logging/src/`
| File | Responsibility |
|------|---------------|
| `index.ts` | Public exports and Pino setup |

### `packages/cli/src/`
| File | Responsibility |
|------|---------------|
| `index.ts` | CLI entry point (Commander.js) |
| `commands/run.ts` | `arena run` — start a session |
| `commands/doctor.ts` | `arena doctor` — environment diagnostics |
| `commands/agents.ts` | `arena agents` — list detected agents |

---

## Tasks

---

### Task 1: Initialize Git Repository and pnpm Workspace

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: Nothing
- Produces: Root workspace that all subsequent packages build on

- [ ] **Step 1: Initialize Git**

```bash
git init
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "arena-monorepo",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint packages/ apps/",
    "lint:fix": "eslint packages/ apps/ --fix",
    "format": "prettier --write \"packages/**/*.{ts,json}\" \"apps/**/*.{ts,json}\"",
    "typecheck": "pnpm -r typecheck",
    "clean": "pnpm -r exec rm -rf dist"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
.arena/
*.tsbuildinfo
.turbo/
.env
.env.local
coverage/
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo scaffold"
```

---

### Task 2: Configure TypeScript and Tooling

**Files:**
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.prettierrc`
- Create: `eslint.config.js`

**Interfaces:**
- Consumes: Task 1 (workspace root)
- Produces: Shared config that all packages inherit

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 90,
  "tabWidth": 2
}
```

- [ ] **Step 4: Create `eslint.config.js`**

```js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "no-console": "warn",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
];
```

- [ ] **Step 5: Install dev dependencies**

```bash
pnpm add -D -w typescript vitest @vitest/coverage-v8 eslint @eslint/js prettier @types/node
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure TypeScript strict, Vitest, ESLint, Prettier"
```

---

### Task 3: Create Core Types — Common Primitives

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types/common.ts`

**Interfaces:**
- Consumes: Task 2 (TypeScript config)
- Produces: `ArenaId`, `Timestamp`, `Result<T,E>`, `Duration` used by all other type files

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@arena/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "t
