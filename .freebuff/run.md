# Agent Arena Web Preview

## How to reproduce artifacts

The web app is a Next.js 14 project in `apps/web/`. Dependencies are installed in `apps/web/node_modules/`.

Workspace packages are symlinked in `apps/web/node_modules/@arena/` for API route imports.

No env files needed — the app runs standalone with the orchestrator using FakeOrchestratorAdapter.

## How to run the server

```bash
# Build first (required for API routes to resolve workspace packages)
cd apps/web && npx next build

# Then start
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
