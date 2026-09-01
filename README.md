# Arena

**Competitive AI collaboration for serious work.**

Arena launches two independent AI coding agents into a structured competitive-collaboration protocol. They analyze, discuss, plan, build, review, and challenge each other — producing better results than either agent alone.

```
Don't trust one AI. Make them check each other.
```

## Quick Start

```bash
# Install
npm install -g arena-cli

# Run with fake agents (no API keys needed)
arena "Build a secure JWT authentication system" --fake

# Run with real agents
arena "Fix the bug in this repository"
```

## How It Works

1. **Independent Analysis** — Both agents analyze the task separately (no anchoring)
2. **Discussion** — They exchange analyses and debate approach
3. **Joint Plan** — They create a shared plan; both must approve
4. **Build/Review Loop** — One builds, the other reviews adversarially
5. **Role Reversal** — Builder becomes Reviewer, Reviewer becomes Builder
6. **Consensus** — Both agents approve the final result, or escalate to you

## Commands

| Command | Description |
|---------|-------------|
| `arena run <task>` | Start a session with two AI agents |
| `arena doctor` | Diagnose your environment |
| `arena agents` | List detected agent adapters |
| `arena sessions` | List past sessions |
| `arena inspect <id>` | Inspect a past session's events |

## Configuration

Create `.arena/config.yaml` in your project root:

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
  strategy: worktree  # direct | worktree | copy

security:
  profile: inherit  # inherit | restricted | isolated

logging:
  level: info
```

## Supported Agents

Arena works with any CLI-based AI coding agent:

- **Claude Code** (`claude`) — Anthropic's coding agent
- **OpenCode** (`opencode`) — Open-source coding agent
- **Generic CLI** — Any agent that reads from stdin and writes to stdout

## Architecture

```
arena/
├── packages/
│   ├── core/          State machine, orchestrator, session, types
│   ├── agents/        Agent adapters (Claude, OpenCode, Generic, Fake)
│   ├── pty/           Persistent sessions, delimiter-based communication
│   ├── config/        YAML/JSON config loading with Zod validation
│   ├── workspace/     Git detection, worktree isolation
│   ├── policy/        Path validation, security
│   ├── verification/  Test runner, lint, build checks
│   └── logging/       Structured logging with Pino
├── apps/
│   └── cli/           Commander.js CLI entry point
└── reference md's/    Product blueprint and agent instruction pack
```

## Development

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Session Storage

Sessions are saved to `.arena/sessions/`:

```
.arena/
└── sessions/
    └── session-1234567890/
        ├── result.json        Outcome, rounds, task
        └── session-xxx.jsonl  All protocol events (JSONL)
```

## Key Design Decisions

- **Local-first** — No data leaves your machine unless you opt in
- **Provider-neutral** — Works with any CLI agent, not locked to one provider
- **Deterministic orchestration** — The runtime controls state, not the LLM
- **Evidence over confidence** — Agents must provide evidence, not just claims
- **Structured findings** — Review findings have severity, evidence, and lifecycle

## License

MIT
