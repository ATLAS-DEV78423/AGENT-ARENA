# Arena — Engineering Instructions

## Stack
TypeScript (strict), Node.js >=20, pnpm, Zod, Vitest, ESLint, Prettier, Pino, Commander.js

## Commands
```bash
pnpm install && pnpm build && pnpm test && pnpm typecheck
```

## Boundaries
- core must NOT depend on agents, pty, or CLI
- agents depends on core only
- provider adapters go in agents/src/<provider>/
- state transitions ONLY via ArenaStateMachine.transition()

## Style
Strict TypeScript, no any, explicit public types, Result<T,E> for recoverable errors.
