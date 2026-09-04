/**
 * Server-side arena runtime.
 *
 * Resolves which agents this host can actually run, executes a two-agent
 * Orchestrator in a per-session scratch directory (so real agents can only
 * touch files inside it), and translates orchestrator events into the chat
 * messages the web UI renders.
 *
 * Two modes, decided here and never mixed:
 *  - "live": every requested agent maps to a real model (opencode CLI, one
 *    process per agent via the persistent-session relay).
 *  - "demo": no agent CLI is available (or fewer than two models are
 *    configured), so the run uses scripted FakeOrchestratorAdapters and the
 *    UI labels the session "Demo".
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  Orchestrator,
  FakeOrchestratorAdapter,
  agentId,
} from "@arena/core";
import type { OrchestratorEvent } from "@arena/core";
import { OpenCodeAdapter } from "@arena/agents";
import type { Receipt } from "@/lib/types";
import { noConsensusMessage, translateArenaEvent } from "./events";
import type { ArenaChatMessage, ArenaPhase, ArenaEventNames } from "./events";

export type { ArenaChatMessage, ArenaPhase } from "./events";

const execFileAsync = promisify(execFile);

export interface ArenaAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  live: boolean;
}

export type ArenaMode = "live" | "demo";

export interface ArenaRunOptions {
  task: string;
  /** Exactly two agent ids from the current roster. */
  requestedIds: string[];
  /** Aborts the run (e.g. the client disconnected); agents are terminated. */
  signal?: AbortSignal;
  onSession?: (mode: ArenaMode) => void;
  onChat?: (message: ArenaChatMessage) => void;
  onPhase?: (phase: ArenaPhase) => void;
  /** Structured facts (plan outcome, findings, roles, consensus) for the verdict. */
  onReceipt?: (receipt: Receipt) => void;
}

export interface ArenaRunResult {
  mode: ArenaMode;
  outcome: string;
  rounds: number;
}

const DEMO_AGENTS: ArenaAgent[] = [
  { id: "claude", name: "Claude", provider: "Anthropic", model: "", live: false },
  { id: "gpt", name: "GPT", provider: "OpenAI", model: "", live: false },
  { id: "gemini", name: "Gemini", provider: "Google", model: "", live: false },
  { id: "qwen", name: "Qwen", provider: "Open source", model: "", live: false },
];

const DEFAULT_LIVE_MODELS = [
  "opencode/mimo-v2.5-free",
  "opencode/nemotron-3.5-lightning-free",
];

/** Models to run live. Override with ARENA_MODELS="provider/model,provider/model". */
function configuredLiveModels(): string[] {
  const raw = process.env.ARENA_MODELS;
  if (!raw) return DEFAULT_LIVE_MODELS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

let opencodeDetected: boolean | null = null;

async function hasOpenCode(): Promise<boolean> {
  if (opencodeDetected === null) {
    try {
      await execFileAsync("opencode", ["--version"], { timeout: 5000 });
      opencodeDetected = true;
    } catch {
      opencodeDetected = false;
    }
  }
  return opencodeDetected;
}

function liveAgent(model: string): ArenaAgent {
  const [provider, ...rest] = model.split("/");
  const name = rest.join("/") || model;
  return { id: name, name, provider: provider || "opencode", model, live: true };
}

/** The agents a user may pick, and whether picking them runs real models. */
export async function getRoster(): Promise<{ agents: ArenaAgent[]; live: boolean }> {
  const models = configuredLiveModels();
  if (!(await hasOpenCode()) || models.length < 2) {
    return { agents: DEMO_AGENTS, live: false };
  }
  return { agents: models.map(liveAgent), live: true };
}

/**
 * Runs the arena. `onSession` fires (with the decided mode) before any agent
 * work starts, so callers can label the session before messages arrive.
 */
export async function runArena(options: ArenaRunOptions): Promise<ArenaRunResult> {
  const { task, requestedIds, onSession, onChat, onPhase, onReceipt } = options;
  const roster = await getRoster();
  const liveAgents = roster.agents.filter((a) => a.live);
  const mode: ArenaMode =
    requestedIds.length === 2 &&
    liveAgents.length >= 2 &&
    requestedIds.every((id) => liveAgents.some((a) => a.id === id))
      ? "live"
      : "demo";
  onSession?.(mode);

  const scratchDir = await mkdtemp(join(tmpdir(), "agent-arena-"));
  const chat = (message: ArenaChatMessage) => onChat?.(message);

  try {
    const adapters =
      mode === "live"
        ? requestedIds.map(
            (id) => new OpenCodeAdapter(liveAgents.find((a) => a.id === id)!.model),
          )
        : requestedIds.map((id) => {
            const agent = DEMO_AGENTS.find((a) => a.id === id);
            return new FakeOrchestratorAdapter(agentId(id), agent?.name ?? id);
          });

    const adapterById = new Map(adapters.map((a) => [a.id as string, a.name]));
    const eventNames: ArenaEventNames = {
      resolveName: (id) => adapterById.get(id),
      agentA: { id: adapters[0]!.id as string, name: adapters[0]!.name },
      agentB: { id: adapters[1]!.id as string, name: adapters[1]!.name },
    };
    const seenEvents: OrchestratorEvent[] = [];
    const handleEvent = (event: OrchestratorEvent) => {
      seenEvents.push(event);
      const actions = translateArenaEvent(event, eventNames);
      if (!actions) {
        // A future orchestrator event — surface it instead of dropping it.
        console.warn(`[arena] Unrecognized orchestrator event "${event.type}" — ignoring.`);
        return;
      }
      for (const action of actions) {
        if (action.kind === "phase") onPhase?.(action.phase);
        else if (action.kind === "chat") chat(action.message);
        else onReceipt?.(action.receipt);
      }
    };

    const orch = new Orchestrator(
      {
        task,
        cwd: scratchDir,
        maxRounds: 1,
        maxMinutes: 8,
        signal: options.signal,
        onEvent: handleEvent,
      },
      adapters[0]!,
      adapters[1]!,
    );

    const result = await orch.run();

    if (result.outcome === "consensus") {
      chat({
        role: "judge",
        agentName: "Judge",
        content: `The agents reached consensus after ${result.rounds} round${result.rounds === 1 ? "" : "s"}.`,
      });
    } else if (result.outcome === "timeout") {
      chat({
        role: "judge",
        agentName: "Judge",
        content: noConsensusMessage(seenEvents, eventNames.resolveName),
      });
    }

    return { mode, outcome: result.outcome, rounds: result.rounds };
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}
