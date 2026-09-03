# Agent Arena Web Preview

## How to reproduce artifacts

The web app is a Next.js project in `apps/web/`, managed by the pnpm workspace at the repo root. Install everything with:

```bash
pnpm install
```

No env files needed. `@arena/core` and `@arena/agents` are declared `workspace:*` dependencies, so `pnpm install` links them automatically.

## How to run the server

```bash
# Build backend packages first (API routes import @arena/core and @arena/agents dist;
# the agents build copies the relay .mjs scripts into dist)
pnpm --filter '@arena/*' build

# Build + start the web app
cd apps/web
npx next build
npx next start -p 3000
```

Port 3000 is the default. If busy, use `-p <port>`.

### Live vs demo arenas

The server detects whether `opencode` is on PATH. If it is (and at least two
models are configured) the arena runs **live** agents — one persistent relay
process per agent calling `opencode run` in a per-session scratch directory.
Otherwise the arena runs a scripted **demo**, and the UI labels sessions
accordingly (`Live agents` / `Demo`).

Which models run live is set by `ARENA_MODELS` (comma-separated
`provider/model` pairs), defaulting to two free-tier models. Example:

```bash
ARENA_MODELS="opencode/mimo-v2.5-free,opencode/nemotron-3.5-lightning-free" npx next start -p 3000
```

Set `ARENA_MODELS` to a single value (or remove `opencode`) to force demo mode.

## API

- `POST /api/arena` — starts an arena session, returns SSE stream of events
  - Body: `{ agents: [id, id], prompt: string }` (exactly two agent ids)
  - Events: `session.created`, `session.mode`, `message`, `session.completed`, `error`
- `GET /api/arena/agents` — the roster the server can actually run (`live: true/false`)

## Architecture

- Frontend: Next.js + Tailwind + Zustand
- Backend runtime: `apps/web/src/lib/arena/runtime.ts` — resolves the roster,
  runs the `@arena/core` Orchestrator in a scratch dir, translates events to
  chat messages, decides live vs demo, reports the real outcome as the verdict
- Orchestrator events reach the API via the first-class `onEvent` config hook
  (no private-method patching)
- Data flow: Store → API (SSE) → runtime → Orchestrator → onEvent → Store → UI
