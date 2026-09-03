# Agent Arena Web Preview

## How to reproduce artifacts

The web app is a Next.js project in `apps/web/`, managed by the pnpm workspace at the repo root. Install everything with:

```bash
pnpm install
```

No env files needed — the app runs standalone with the orchestrator using FakeOrchestratorAdapter. `@arena/core` is a declared `workspace:*` dependency, so `pnpm install` links it automatically.

## How to run the server

```bash
# Build backend packages first (API routes import @arena/core dist)
pnpm --filter '@arena/*' build

# Build + start the web app
cd apps/web
npx next build
npx next start -p 3000
```

Port 3000 is the default. If busy, use `-p <port>`.

## API

- `POST /api/arena` — starts an arena session, returns SSE stream of events
  - Body: `{ agents: string[], prompt: string }`
  - Events: `session.created`, `message`, `session.completed`, `error`
- `GET /api/arena` — lists active sessions

## Architecture

- Frontend: Next.js + Tailwind + Zustand
- Backend: `@arena/core` orchestrator with `FakeOrchestratorAdapter`
- Data flow: Store → API (SSE) → Orchestrator → Events → Store → UI
