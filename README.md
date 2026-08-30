# Arena

Competitive AI collaboration for serious work.

## Quickstart

```bash
pnpm install
pnpm build
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js agents
node apps/cli/dist/index.js run "Fix the bug"
```

## Packages

| Package | Purpose |
|---------|--------|
| @arena/core | State machine, protocol, types, session |
| @arena/agents | Agent adapter interface + registry + fake |
| @arena/pty | Process management (child_process) |
| @arena/workspace | Git integration, worktree |
| @arena/policy | Path validation, security |
| @arena/config | Zod config schema |
| @arena/logging | Pino logger factory |
| @arena/cli | CLI entry point |

## Development

```bash
pnpm test
pnpm typecheck
pnpm lint
```
