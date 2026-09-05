# Agent Arena

**Competitive AI collaboration for serious work.**

Agent Arena launches two AI coding agents into a structured competitive-collaboration protocol. They analyze, discuss, plan, build, review, and challenge each other — producing better results than either agent alone — then a judge-style final approval gates the result.

```
Don't trust one AI. Make them check each other.
```

## Quick Start

```bash
# Install and build the monorepo (Node.js >= 20, pnpm >= 9)
pnpm install && pnpm build

# Run a session with fake agents (no API keys or agent CLIs needed)
pnpm --filter arena-cli start -- run "Design a rate limiter" --fake

# Or via the built CLI directly
node apps/cli/dist/index.js run "Design a rate limiter" --fake
```

Real agents (Claude Code, OpenCode, or any CLI agent) work the same way — drop the `--fake` flag:

```bash
node apps/cli/dist/index.js run "Fix the bug in this repository" --no-verify
```

> `--no-verify` disables the test/typecheck gate for non-Node projects. Verification
> runs `pnpm test` after each build round and is **enforced** — a failing suite is
> sent back to the builder and the reviewer is only consulted once verification passes.

## Web App

A local web UI (`apps/web`) wraps the same orchestrator over an SSE API:

```bash
cd apps/web
pnpm install && pnpm dev   # http://localhost:3000
```

Choose agents, run an Arena, and watch analysis → discussion → review stream in
real time. The API route (`apps/web/src/app/api/arena`) drives the real
`Orchestrator` from `@arena/core`; the server detects which agent CLIs/models
are available and runs them live, falling back to a scripted demo otherwise.
See `.freebuff/run.md` for the `ARENA_MODELS` / `ARENA_TIMEOUTS` knobs.

## How It Works

1. **Independent Analysis** — Both agents analyze the task separately (no anchoring)
2. **Discussion** — They exchange analyses and debate approach
3. **Joint Plan** — They create a shared plan; both must approve
4. **Build/Review Loop** — One builds, the other reviews adversarially
5. **Verification Gate** — Failing tests/typechecks go back to the builder; the reviewer is only consulted when checks pass
6. **Role Reversal** — Builder becomes Reviewer, Reviewer becomes Builder
7. **Consensus** — Both agents approve the final result, or the session escalates/times out honestly

The runtime — not the LLM — owns state transitions, round limits, budget, and
finalization (`packages/core/src/types/state-machine.ts`).

## CLI Commands

| Command | Description |
|---------|-------------|
| `arena run <task>` | Start a session with two AI agents |
| `arena doctor` | Diagnose your environment (node, pnpm, git, agent CLIs) |
| `arena agents` | List detected agent adapters |
| `arena sessions` | List past sessions |
| `arena inspect <id>` | Inspect a past session's result + protocol events |
| `arena resume <id>` | Re-run a timed-out/failed session from its saved task |

Options for `arena run`:

| Flag | Description |
|------|-------------|
| `--fake` | Use fake agents (no external CLI needed) |
| `--model-a <cmd>` / `--model-b <cmd>` | Agent command per side |
| `--rounds <n>` | Max build/review rounds (default 5) |
| `--security <profile>` | `inherit` \| `restricted` \| `isolated` |
| `--no-verify` | Skip the test/typecheck verification gate |

**Interrupting a session:** `Ctrl+C` triggers a graceful shutdown — child agents are
terminated, worktrees cleaned up, and the partial session (events + result) is
preserved under `.arena/sessions/`. Sessions are safe to `resume` afterwards.

## Configuration

Create `.arena/config.yaml` (or `.arena/config.json`) in your project root:

```yaml
agents:
  - id: claude
    command: claude
  - id: codex
    command: codex

debate:
  maxRounds: 5
  maxMinutes: 20
  maxRepeatedObjections: 2

verification:
  runTests: true
  requireCleanReview: true

workspace:
  strategy: direct  # direct | worktree (worktree falls back to direct outside a git repo)

security:
  profile: inherit  # inherit | restricted | isolated

logging:
  level: info
```

Every value has a sane default — the file is optional.

## Security

Three layers (`packages/policy`):

- **CommandPolicy** — allow/blocklist for agent shell commands, shell-metacharacter detection
- **SecretRedactor** — strips API keys, tokens, and credentials from agent output and logs
- **SecurityGuard** — enforces a profile (`inherit`/`restricted`/`isolated`) over command policy + redaction; orchestrator logs and persisted events are redacted before they hit disk

## Session Storage

Sessions are saved to `.arena/sessions/`:

```
.arena/
└── sessions/
    └── session-1234567890/
        ├── result.json          Outcome, rounds, task, state
        └── session-<uuid>.jsonl Protocol events (redacted), JSONL
```

## Architecture

```
├── packages/
│   ├── core/          State machine, orchestrator, session, findings, budget, event store
│   ├── agents/        Agent adapters (Claude, OpenCode, Generic, Fake) — persistent relay sessions
│   ├── pty/           Persistent child-process sessions, delimiter protocol
│   ├── config/        YAML/JSON config loading with Zod validation
│   ├── workspace/     Git detection, worktree isolation
│   ├── policy/        Command policy, secret redaction, security guard
│   ├── verification/  Test/typecheck runner used as the build gate
│   └── logging/       Structured logging (Pino)
├── apps/
│   ├── cli/           Commander.js CLI entry point
│   └── web/           Next.js web UI (Osaka Jade design, SSE arena streaming)
└── reference md's/    Product blueprint + agent instruction pack
```

Layering rule: `core` never depends on `agents`/`pty`/`cli`; `agents` depends on
`core` and `pty`. Provider adapters live in `packages/agents/src/<provider>/`.

## Development

```bash
pnpm install
pnpm test        # vitest, all packages
pnpm typecheck   # tsc --noEmit per package
pnpm build       # emit dist per package
```

## Key Design Decisions

- **Local-first** — no data leaves your machine unless you opt in
- **Provider-neutral** — works with any CLI agent, not locked to one provider
- **Deterministic orchestration** — the runtime controls state, not the LLM
- **Evidence over confidence** — verification results gate the reviewer; agents must provide evidence, not claims
- **Structured findings** — review findings carry severity, evidence, and a lifecycle
- **Honest outcomes** — exhausted rounds or failing verification end as `timeout`, never a fabricated `consensus`

## License

MIT
