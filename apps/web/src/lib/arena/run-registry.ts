/**
 * Server-side arena run registry.
 *
 * A run must outlive the HTTP request that started it: when the page reloads
 * mid-arena, the POST connection dies but the run keeps going, and a later
 * subscriber (the reloaded page) reconnects to the same run. Each run buffers
 * every frame it pushes so a late subscriber can replay from its own cursor
 * (`after = number of frames it already consumed`) and then receive live
 * frames until the run's terminal event closes the stream.
 *
 * Runs are in-memory only (one Next server process). A finished run stays
 * readable for RECONNECT_WINDOW_MS so a page that reloads just after the run
 * ended can still reconstruct the full transcript; after that it is evicted.
 */
export type RunFrame = { event: string; data: Record<string, unknown> };

export interface ArenaRun {
  sessionId: string;
  frames: RunFrame[];
  /** True once the terminal frame has been pushed. */
  finished: boolean;
  finishedAt?: number;
}

const RECONNECT_WINDOW_MS = 5 * 60 * 1000;

const runs = new Map<string, ArenaRun>();
const subscribers = new Map<ArenaRun, Set<(frame: RunFrame) => void>>();

function isTerminal(event: string): boolean {
  return event === "session.completed" || event === "error";
}

function notify(run: ArenaRun, frame: RunFrame) {
  const listeners = subscribers.get(run);
  if (!listeners) return;
  for (const onFrame of listeners) {
    try {
      onFrame(frame);
    } catch {
      // A subscriber's connection died mid-frame (a reload aborted its
      // stream, so controller.enqueue now throws). Drop it — one dead
      // connection must not kill the run's push for everyone else.
      listeners.delete(onFrame);
    }
  }
}

/** Evicts runs whose terminal frame is older than the reconnect window. */
export function sweep() {
  const now = Date.now();
  for (const [sessionId, run] of runs) {
    if (run.finished && run.finishedAt !== undefined && now - run.finishedAt > RECONNECT_WINDOW_MS) {
      runs.delete(sessionId);
      subscribers.delete(run);
    }
  }
}

export function createRun(sessionId: string): ArenaRun {
  sweep();
  const run: ArenaRun = { sessionId, frames: [], finished: false };
  runs.set(sessionId, run);
  return run;
}

export function getRun(sessionId: string): ArenaRun | undefined {
  sweep();
  return runs.get(sessionId);
}

/** Appends a frame to the run's buffer and notifies every current subscriber. */
export function push(run: ArenaRun, event: string, data: Record<string, unknown>) {
  const frame: RunFrame = { event, data };
  run.frames.push(frame);
  if (isTerminal(event)) {
    run.finished = true;
    run.finishedAt = Date.now();
  }
  notify(run, frame);
}

/**
 * Delivers `run.frames[after..]` immediately, then every live frame until the
 * run's terminal frame, then resolves. A subscriber that attaches after the
 * run finished receives the replay (terminal frame included) and resolves.
 */
export async function subscribe(
  run: ArenaRun,
  after: number,
  onFrame: (frame: RunFrame) => void,
): Promise<void> {
  sweep();
  for (const frame of run.frames.slice(after)) {
    onFrame(frame);
    if (isTerminal(frame.event)) return;
  }
  if (run.finished) return;
  await new Promise<void>((resolve) => {
    let listeners = subscribers.get(run);
    if (!listeners) {
      listeners = new Set();
      subscribers.set(run, listeners);
    }
    const listener = (frame: RunFrame) => {
      onFrame(frame);
      if (isTerminal(frame.event)) {
        listeners!.delete(listener);
        resolve();
      }
    };
    listeners.add(listener);
  });
}
