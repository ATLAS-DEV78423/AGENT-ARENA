/**
 * Per-model call budgets for live agents.
 *
 * A relay process's first model call is a cold start (process spawn + provider
 * handshake + first token) and can exceed the steady per-call budget by far —
 * on this host the free models routinely blew the flat 120s cap on call one
 * while answering fine afterwards. The web server lets an operator raise the
 * budget per model (and per first call) with ARENA_TIMEOUTS:
 *
 *   ARENA_TIMEOUTS="opencode/nemotron-3.5-lightning-free=180000:360000,mimo-v2.5-free=240000"
 *
 * Each entry is `key=steadyMs[:firstCallMs]`; keys match the full
 * `provider/model` or the short model name. An entry with only the steady ms
 * leaves the first-call default in place. Defaults live in @arena/agents
 * alongside the adapter that enforces them, so they cannot drift apart.
 */
import { DEFAULT_CALL_TIMEOUT_MS, DEFAULT_FIRST_CALL_TIMEOUT_MS } from "@arena/agents";

export interface CallTimeouts {
  steadyMs: number;
  firstCallMs: number;
}

function modelSlug(model: string): string {
  return model.split("/").pop() ?? model;
}

export function resolveModelTimeouts(
  model: string,
  raw: string | undefined,
): CallTimeouts {
  let steadyMs = DEFAULT_CALL_TIMEOUT_MS;
  let firstCallMs = DEFAULT_FIRST_CALL_TIMEOUT_MS;
  if (!raw) return { steadyMs, firstCallMs };

  const slug = modelSlug(model);
  for (const entry of raw.split(",")) {
    const eq = entry.indexOf("=");
    if (eq <= 0) continue; // no key, or empty key
    const key = entry.slice(0, eq).trim();
    if (key !== model && key !== slug) continue;
    const [steady, first] = entry.slice(eq + 1).split(":");
    const steadyNum = Number(steady?.trim());
    if (!Number.isFinite(steadyNum) || steadyNum <= 0) continue;
    steadyMs = steadyNum;
    const firstNum = Number(first?.trim());
    if (Number.isFinite(firstNum) && firstNum > 0) firstCallMs = firstNum;
  }
  return { steadyMs, firstCallMs };
}
