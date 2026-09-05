# Agent Arena — Web UI

A local web surface for running multi-agent arena sessions: send one prompt to
two agents, watch them analyse, discuss, and review in real time, then compare
side by side and decide — with an honest record of what happened.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Production:

```bash
pnpm build && pnpm start
```

The arena runs **live** when two models are configured and their CLI is on
PATH (see the run doc at `.freebuff/run.md` for `ARENA_MODELS` and the
per-model `ARENA_TIMEOUTS` knobs); otherwise it runs a scripted **demo** and
labels sessions accordingly.

## What's Inside

- **Arena setup** — pick exactly two agents, type one prompt, run. Live rosters
  come from `GET /api/arena/agents`.
- **Live streaming** — `POST /api/arena` opens an SSE stream driven by the real
  `@arena/core` Orchestrator. The transcript streams analysis → discussion →
  plan → review → verdict, with a per-agent phase strip while a run is live.
- **Honest outcomes** — consensus, no-consensus (with its real cause: silent
  agent, rejection, deadlock, or exhausted budget), interrupted, and
  server-error sessions are all labelled truthfully, each with the rerun
  affordance that fits (Run again / Rematch).
- **Verdict receipts** — completed sessions cite what actually happened: who
  approved or rejected the plan, which findings were filed, whose answer stands.
- **Reconnect** — a reload mid-run reconnects to the still-live server-side run
  (per-session SSE cursor + `GET /api/arena/[sessionId]/stream`) instead of
  showing a dead run. A run whose owner genuinely died shows the interrupted
  banner with Retry.
- **Two-tab safe** — sessions persist to one localStorage journal with
  newer-wins merging and a lease protocol, so a second tab sees the live run
  and never clobbers it.
- **Command palette** (`⌘K`), session history, Compare view, settings.

## Wiring

```
src/app/api/arena/route.ts             POST /api/arena (SSE, run decoupled from the connection)
src/app/api/arena/[sessionId]/stream/  GET — reconnect/replay a run from a cursor
src/app/api/arena/agents/route.ts      GET — the runnable agent roster
src/lib/arena/runtime.ts               Roster resolution, live vs demo, event translation
src/lib/arena/run-registry.ts          Server-side run buffer for replay + reconnect
src/lib/store.ts                       Zustand store: SSE consumption, persistence, leases
src/lib/arena/terminal.ts              Terminal-status decision (pure, unit-tested)
src/lib/arena/timeouts.ts              Per-model call-timeout resolution (pure, unit-tested)
```

## Design System

Tokens live in `src/app/globals.css`:

- Surfaces: `#111C18` → `#1B2923` (dark neutral greens)
- Text: `#F0F0E8` primary, warm secondary/muted tones
- Accent: jade `#509475` — used sparingly
- Status: restrained success/warning/error hues

Typography is Inter-class sans with mono for metadata and model names — depth
from surface changes and spacing, not shadows or neon.
