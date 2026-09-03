# Agent Arena — Web UI

The Agent Arena desktop web application: a premium, minimalist chat surface
(Osaka Jade palette) for running multi-agent arena sessions against the
`@arena/core` orchestrator.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Production:

```bash
pnpm build && pnpm start
```

## What's Inside

- **Arena mode** — pick agents (Claude, GPT, Gemini, Qwen, or any registered
  adapter), send one prompt, watch each agent respond.
- **Live streaming** — `POST /api/arena` opens an SSE stream driven by the real
  `Orchestrator`; analysis, discussion, and consensus events render as they fire.
  Falls back to mock responses if the API is unavailable.
- **Judge/evaluation** — final consensus message closes the session.
- **Command palette** (`⌘K`), settings, session history, agent selector.

## Wiring

```
src/app/api/arena/route.ts   POST /api/arena (SSE) + GET session list
src/app/api/arena/[id]/      Per-session status (GET)
src/lib/store.ts             Zustand store → fetches API, streams SSE
src/lib/mock-data.ts         Fallback agents/sessions/responses
```

The API route currently uses `FakeOrchestratorAdapter`. To use real agents,
swap in `ClaudeAdapter` / `OpenCodeAdapter` from `@arena/agents` and pass the
requested agent commands through config.

## Design System

Tokens live in `src/app/globals.css`:

- Surfaces: `#111C18` → `#1B2923` (dark neutral greens)
- Text: `#F0F0E8` primary, warm secondary/muted tones
- Accent: jade `#509475` — used sparingly (~5% of the UI)
- Status: restrained success/warning/error hues

Typography is Inter-class sans (15–16px chat text) with mono for metadata and
model names. No bright neon, no pure white, no heavy shadows — depth comes from
surface changes and spacing.
