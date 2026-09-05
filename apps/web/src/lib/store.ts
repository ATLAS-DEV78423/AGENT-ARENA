import { create } from "zustand";
import { AGENTS } from "./mock-data";
import { terminalStatus } from "./arena/terminal";
import type { TerminalSignal } from "./arena/terminal";
import type { Agent, Message, Receipt, Session } from "./types";

const STORAGE_KEY = "agent-arena:sessions:v1";
const LEASE_KEY = "agent-arena:leases:v1";
const OWNER_KEY = "agent-arena:owner:v1";
/** A running session with a lease fresher than this is alive in another tab. */
const LEASE_TTL_MS = 6000;
const LEASE_BEAT_MS = 2000;
const POLL_MS = 2000;

let lastStoredRaw: string | null = null;
let leaseTimer: ReturnType<typeof setInterval> | null = null;
/** Sessions this tab is mid-reconnect for — one attempt at a time. */
const adopting = new Set<string>();
/** Runs this server process no longer holds — reconnect would 404, stop asking. */
const gone = new Set<string>();
/** Abort handles for streams this page consumes, so a dismiss can stop them. */
const readers = new Map<string, AbortController>();
/** True once this page starts unloading — aborted requests then are navigation, not failures. */
let pageLeaving = false;

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full/unavailable — transcripts stay in memory
  }
}

// Dates are stored as ISO strings in localStorage
interface StoredMessage extends Omit<Message, "timestamp"> {
  timestamp: string;
}
interface StoredSession extends Omit<Session, "createdAt" | "updatedAt" | "messages"> {
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

function serialize(sessions: Session[]): string {
  return JSON.stringify(
    sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messages: s.messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
    })),
  );
}

function deserialize(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as StoredSession[]).map((s) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  return deserialize(safeRead(STORAGE_KEY));
}

/**
 * Newer-wins per session: the shared journal is the base; anything newer in
 * `local` (streaming updates, this tab's actions) overlays it. Sessions only
 * in `local` (just created here) survive; sessions only in the base (created
 * or updated in another tab) survive. This is the clobber-prevention rule for
 * both directions — a stale write can never drop a newer snapshot.
 */
function mergeSessions(local: Session[], base: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of base) byId.set(s.id, s);
  for (const s of local) {
    const prev = byId.get(s.id);
    if (!prev || s.updatedAt.getTime() >= prev.updatedAt.getTime()) byId.set(s.id, s);
  }
  return [...byId.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

/** Writes the journal, merging with whatever another tab wrote since our last write. */
function writeSessions(sessions: Session[]) {
  if (sessions.length === 0) {
    lastStoredRaw = "[]";
    safeSet(STORAGE_KEY, lastStoredRaw);
    return;
  }
  const storedRaw = safeRead(STORAGE_KEY);
  const base = storedRaw && storedRaw !== lastStoredRaw ? deserialize(storedRaw) : [];
  const next = serialize(mergeSessions(sessions, base));
  if (next === storedRaw) return; // identical to what's on disk — no storage event, no tab ping-pong
  lastStoredRaw = next;
  safeSet(STORAGE_KEY, next);
}

function readLeases(): Record<string, number> {
  const raw = safeRead(LEASE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeLease(sessionId: string) {
  const leases = readLeases();
  leases[sessionId] = Date.now();
  safeSet(LEASE_KEY, JSON.stringify(leases));
}

function clearLease(sessionId: string) {
  const leases = readLeases();
  if (!(sessionId in leases)) return;
  delete leases[sessionId];
  safeSet(LEASE_KEY, JSON.stringify(leases));
}

/** Session ids with a fresh lease — their owning tab is streaming right now. */
function remoteRunningIds(): string[] {
  const now = Date.now();
  return Object.entries(readLeases())
    .filter(([, beat]) => now - beat < LEASE_TTL_MS)
    .map(([id]) => id);
}

function refreshRemoteRunning() {
  const ids = remoteRunningIds();
  useStore.setState((state) =>
    state.remoteRunning.length === ids.length &&
      state.remoteRunning.every((id, i) => id === ids[i])
      ? state
      : { remoteRunning: ids },
  );
}

// --- Ownership of a stream this tab consumes ---------------------------------
// begin/end bracket streaming from this page: the localStorage lease (so other
// tabs see the run as live, not interrupted), the heartbeat that keeps it
// fresh, the sessionStorage marker (so a reload knows the run was ours and
// reconnects to it immediately), and activeRunId (the banner/phase-strip
// guard). All idempotent — safe to call from both startArena and reconnect.

function readOwner(): string | null {
  try {
    return window.sessionStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function clearOwner(sessionId: string) {
  try {
    if (window.sessionStorage.getItem(OWNER_KEY) === sessionId) {
      window.sessionStorage.removeItem(OWNER_KEY);
    }
  } catch {
    // sessionStorage unavailable — nothing to clear
  }
}

function beginOwnership(sessionId: string) {
  writeLease(sessionId);
  try {
    window.sessionStorage.setItem(OWNER_KEY, sessionId);
  } catch {
    // sessionStorage unavailable — the lease still guards other tabs
  }
  if (leaseTimer) clearInterval(leaseTimer);
  leaseTimer = setInterval(() => writeLease(sessionId), LEASE_BEAT_MS);
}

function endOwnership(sessionId: string) {
  if (leaseTimer) clearInterval(leaseTimer);
  leaseTimer = null;
  clearLease(sessionId);
  clearOwner(sessionId);
  refreshRemoteRunning();
  useStore.setState((state) => ({
    activeRunId: state.activeRunId === sessionId ? null : state.activeRunId,
  }));
}

// --- SSE consumption ----------------------------------------------------------

/**
 * Applies one SSE frame to its session, advancing the per-session cursor in
 * the same state write so the two can never drift apart on disk: `cursor` is
 * the count of frames this client has consumed from the run's stream, and a
 * reload reconnects at that exact index — no frame is delivered twice or lost.
 */
function applyFrame(sessionId: string, event: string, data: Record<string, unknown>, cursor: number) {
  useStore.setState((state) => ({
    sessions: state.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      let patch: Partial<Session> = { sseCursor: cursor, updatedAt: new Date() };
      if (event === "session.mode" && (data.mode === "live" || data.mode === "demo")) {
        patch.mode = data.mode;
      } else if (event === "phase") {
        const key = String(data.phase ?? "");
        if (key) {
          patch.phase = {
            key,
            agentId: data.agentId as string | undefined,
            agentName:
              typeof data.agentName === "string" && data.agentName
                ? data.agentName
                : undefined,
            since: Date.now(),
          };
        }
      } else if (event === "receipt") {
        const kind = String(data.kind ?? "");
        if (kind) patch.receipts = [...(s.receipts ?? []), data as unknown as Receipt];
      } else if (event === "message") {
        const msg: Message = {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: data.role === "judge" ? "judge" : "arena",
          agentId: data.agentId as string | undefined,
          agentName:
            typeof data.agentName === "string" && data.agentName
              ? data.agentName
              : data.role === "judge"
                ? "Judge"
                : (data.agentId as string) || String(data.role),
          content: String(data.content ?? ""),
          timestamp: new Date(),
        };
        patch.messages = [...s.messages, msg];
      } else if (event === "error") {
        patch.messages = [
          ...s.messages,
          {
            id: `m-${Date.now()}-error`,
            role: "judge",
            agentId: "judge",
            agentName: "Judge",
            content: `Arena session failed: ${String(data.message ?? "the run errored on the server")}`,
            timestamp: new Date(),
          },
        ];
      }
      return { ...s, ...patch };
    }),
  }));
}

/**
 * Reads an arena SSE stream to completion and applies it to the session: every
 * frame advances the session cursor and lands its mode/phase/receipt/message,
 * and the terminal status is decided by what the stream actually reported
 * (completed-with-error is `error`, a clean end stays `completed`). Callers
 * bracket this with begin/endOwnership.
 */
async function consumeArenaStream(sessionId: string, response: Response, startCursor: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const controller = new AbortController();
  readers.set(sessionId, controller);
  try {
    const decoder = new TextDecoder();
    let buffer = "";
    let cursor = startCursor;
    let terminal: TerminalSignal = { kind: "none" };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: string;
        let data: Record<string, unknown>;
        try {
          ({ event, data } = JSON.parse(line.slice(6)));
        } catch {
          continue; // skip malformed lines
        }

        cursor += 1;
        applyFrame(sessionId, event, data, cursor);
        if (event === "session.completed") {
          terminal = { kind: "completed", outcome: String(data.outcome ?? "") };
        } else if (event === "error") {
          terminal = { kind: "error" };
        }
      }
    }

    // A terminal status ends the run — drop the live phase so no stale
    // progress strip survives into the transcript.
    useStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, status: terminalStatus(terminal), phase: undefined, sseCursor: cursor }
          : s,
      ),
    }));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return; // dismissed — status already set
    throw error;
  } finally {
    readers.delete(sessionId);
  }
}

// --- Reconnect ----------------------------------------------------------------

/**
 * Reconnects to a still-running arena this page did not start: a reload killed
 * the POST stream, but the run lives on server-side (GET stream replays the
 * frames past our persisted cursor, then streams live). Adopts ownership only
 * if the session is still genuinely running and nothing else is streaming —
 * otherwise the existing interrupted/Retry flow stays in charge.
 *
 * `force` is set when the sessionStorage owner marker says this very tab ran
 * the arena before a reload: the lease it left behind is our own (still fresh
 * for a few seconds), so it must not count as another live owner.
 */
async function reconnectToRun(sessionId: string, force = false) {
  if (adopting.has(sessionId) || gone.has(sessionId)) return;
  const snapshot = useStore.getState();
  const session = snapshot.sessions.find((s) => s.id === sessionId);
  if (!session || session.status !== "running") return;
  if (snapshot.activeRunId) return;
  if (!force && snapshot.remoteRunning.includes(sessionId)) return;

  adopting.add(sessionId);
  let owned = false;
  try {
    const cursor = session.sseCursor ?? 0;
    // The lease beat we started with: if it advances while the request is in
    // flight, another page adopted the run first — step aside for it.
    const leaseBefore = readLeases()[sessionId] ?? 0;
    const response = await fetch(
      `/api/arena/${encodeURIComponent(sessionId)}/stream?after=${cursor}`,
    );
    if (!response.ok) {
      // The server no longer holds this run (it finished beyond the reconnect
      // window, or the server restarted) — the stream is genuinely gone.
      gone.add(sessionId);
      return;
    }
    // Re-check before adopting: the user may have retried or dismissed while
    // the request was in flight, or another tab may have adopted it first.
    const now = useStore.getState();
    const current = now.sessions.find((s) => s.id === sessionId);
    const leaseNow = readLeases()[sessionId] ?? 0;
    if (!current || current.status !== "running" || now.activeRunId || leaseNow > leaseBefore) {
      return;
    }
    beginOwnership(sessionId);
    owned = true;
    useStore.setState({ activeRunId: sessionId, activeSessionId: sessionId });
    try {
      await consumeArenaStream(sessionId, response, cursor);
    } catch (error) {
      // The reconnect stream died too — leave the session stranded (running,
      // no lease) so the interrupted banner with Retry appears, as before.
      console.error("Arena reconnect failed:", error);
    }
  } finally {
    adopting.delete(sessionId);
    // Only end what we began — a skipped adoption must not clear another
    // tab's lease for the same session.
    if (owned) endOwnership(sessionId);
  }
}

/** Reconnect trigger: a running session no one holds a fresh lease for. */
function maybeReconnect() {
  const { sessions, remoteRunning, activeRunId } = useStore.getState();
  if (activeRunId) return;
  for (const s of sessions) {
    if (s.status === "running" && !remoteRunning.includes(s.id)) void reconnectToRun(s.id);
  }
}

interface ArenaStore {
  agents: Agent[];
  /** True when the server reported live agents at the last refresh. */
  live: boolean;
  sessions: Session[];
  /** Sessions a running arena is live in another tab (fresh lease). */
  remoteRunning: string[];
  activeSessionId: string | null;
  /** The session currently streaming from this page (set while reading SSE). */
  activeRunId: string | null;
  selectedAgentIds: string[];
  arenaOpen: boolean;
  /** Prompt the arena setup opens pre-filled with (seeded by Rematch). */
  arenaDraftPrompt: string;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;

  // Actions
  refreshAgents: () => Promise<void>;
  openArena: (agentIds?: string[], draftPrompt?: string) => void;
  closeArena: () => void;
  setActiveSession: (id: string | null) => void;
  toggleAgent: (id: string) => void;
  startArena: (agentIds: string[], prompt: string) => Promise<void>;
  markInterrupted: (id: string) => void;
  clearHistory: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useStore = create<ArenaStore>((set) => ({
  agents: AGENTS,
  live: false,
  sessions: [],
  remoteRunning: [],
  activeSessionId: null,
  activeRunId: null,
  selectedAgentIds: ["claude", "gpt"],
  arenaOpen: false,
  arenaDraftPrompt: "",
  commandPaletteOpen: false,
  settingsOpen: false,

  openArena: (agentIds, draftPrompt) =>
    set({
      arenaOpen: true,
      activeSessionId: null,
      // Every open path clears the draft; Rematch seeds it from its session.
      arenaDraftPrompt: draftPrompt ?? "",
      ...(agentIds ? { selectedAgentIds: agentIds } : {}),
    }),

  closeArena: () => set({ arenaOpen: false }),

  refreshAgents: async () => {
    try {
      const res = await fetch("/api/arena/agents");
      if (!res.ok) return;
      const { agents, live } = (await res.json()) as {
        agents: Array<{ id: string; name: string; provider: string; model?: string; live?: boolean }>;
        live: boolean;
      };
      if (!agents.length) return;
      const roster: Agent[] = agents.map((a) => ({
        id: a.id,
        name: a.name,
        provider: a.provider,
        model: a.model,
        status: a.live ? "online" : "offline",
        live: Boolean(a.live),
      }));
      set((state) => {
        const kept = state.selectedAgentIds.filter((id) => roster.some((a) => a.id === id));
        return {
          agents: roster,
          live,
          selectedAgentIds:
            kept.length >= 2
              ? kept
              : live
                ? roster.filter((a) => a.live).slice(0, 2).map((a) => a.id)
                : ["claude", "gpt"].filter((id) => roster.some((a) => a.id === id)),
        };
      });
    } catch {
      // Keep the demo roster; runs are labeled honestly via the session mode.
    }
  },

  setActiveSession: (id) => set({ activeSessionId: id, arenaOpen: false }),

  markInterrupted: (id) => {
    readers.get(id)?.abort();
    clearOwner(id);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id && s.id !== state.activeRunId
          ? { ...s, status: "interrupted", phase: undefined }
          : s,
      ),
    }));
  },

  clearHistory: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    set({ sessions: [], activeSessionId: null });
  },

  // The server contract is exactly two minds — selecting a third swaps out
  // the oldest pick instead of growing the list.
  toggleAgent: (id) =>
    set((state) => ({
      selectedAgentIds: state.selectedAgentIds.includes(id)
        ? state.selectedAgentIds.filter((a) => a !== id)
        : [...state.selectedAgentIds, id].slice(-2),
    })),

  startArena: async (agentIds, prompt) => {
    // One arena at a time — the guard lives here so every entry point (Run,
    // Run again, Retry) is covered even on double-clicks. Interrupted sessions
    // are marked before a retry, so they never block it.
    if (useStore.getState().sessions.some((s) => s.status === "running")) return;

    // Random suffix so two tabs starting arenas in the same millisecond don't collide.
    const sessionId = `arena-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    // Create session immediately with user message
    const newSession: Session = {
      id: sessionId,
      title: prompt.slice(0, 50) + (prompt.length > 50 ? "..." : ""),
      type: "arena",
      agents: agentIds,
      messages: [
        {
          id: `m-${Date.now()}`,
          role: "user",
          content: prompt,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      status: "running",
      sseCursor: 0,
      phase: { key: "starting", since: now.getTime() },
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: sessionId,
      activeRunId: sessionId,
      arenaOpen: false,
    }));

    // Heartbeat so other tabs see this run as live (not "interrupted"), and a
    // marker so a reload knows this run was ours and reconnects to it.
    beginOwnership(sessionId);

    try {
      const response = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: agentIds, prompt, sessionId }),
      });

      if (!response.ok) {
        // Surface the server's own rejection (e.g. "exactly two agents") instead
        // of labeling a validation 400 as a network failure.
        let detail = "";
        try {
          const body = (await response.json()) as { error?: unknown };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // Non-JSON error body — fall back to the status code.
        }
        const message = detail || `Request failed (${response.status})`;
        useStore.setState((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, status: "error", phase: undefined } : s,
          ),
        }));
        useStore.setState((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: `m-${Date.now()}-error`,
                      role: "judge",
                      agentId: "judge",
                      agentName: "Judge",
                      content: `Arena request failed — ${message}`,
                      timestamp: new Date(),
                    },
                  ],
                }
              : s,
          ),
        }));
        return;
      }

      await consumeArenaStream(sessionId, response, 0);
    } catch (error) {
      // Navigating away (reload/close) aborts the in-flight fetch — that is
      // not a server failure: the run continues server-side and the reloaded
      // page reconnects to it. Label nothing and leave the lease/marker so the
      // next page can. A genuine failure keeps the honest bubble below.
      if (pageLeaving || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }
      // Honest failure: surface it instead of fabricating agent answers. A fetch
      // rejection (TypeError) means the server was unreachable; any other error
      // carries the server's own answer, worth repeating verbatim.
      console.error("Arena request failed:", error);
      const serverSaid =
        error instanceof Error && !(error instanceof TypeError) && error.message ? error.message : "";
      useStore.setState((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, status: "error", phase: undefined } : s,
        ),
      }));
      useStore.setState((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: `m-${Date.now()}-error`,
                    role: "judge",
                    agentId: "judge",
                    agentName: "Judge",
                    content: serverSaid
                      ? `Arena request failed — ${serverSaid}`
                      : "Arena request failed — the session could not run. Is the server reachable?",
                    timestamp: new Date(),
                  },
                ],
              }
            : s,
        ),
      }));
    } finally {
      // While the page is dying the next page will adopt this run — keep its
      // lease and owner marker so that adoption can find it.
      if (!pageLeaving) endOwnership(sessionId);
    }
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));

// Persist transcripts locally so a reload doesn't wipe history, and stay in
// sync with other tabs: storage events adopt the other tab's journal (with the
// newer-wins merge, so our own in-flight stream is never replaced), lease
// events update who is running elsewhere, and a poll detects a dead owner
// (leases go stale without events) and reconnects to runs that outlived their
// owner. Hydration runs after mount (setTimeout) so the first client render
// matches the server render without a React warning.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    pageLeaving = true;
  });
  lastStoredRaw = safeRead(STORAGE_KEY);
  const stored = loadSessions();
  if (stored.length) {
    setTimeout(() => {
      useStore.setState({ sessions: stored });
      // This tab streamed a run before the reload — reconnect to it now, even
      // while its lease is still fresh (it is ours, not another tab's).
      const owned = readOwner();
      if (owned && stored.some((s) => s.id === owned && s.status === "running")) {
        void reconnectToRun(owned, true);
      }
    }, 0);
  }
  // Know right away whether another tab is streaming (lease TTL is 6s, so a
  // live run always has a fresh lease at load time) — no wrong banner flash.
  refreshRemoteRunning();

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      const base = e.newValue ? deserialize(e.newValue) : [];
      useStore.setState((state) => ({
        sessions: mergeSessions(state.sessions, base),
      }));
    } else if (e.key === LEASE_KEY) {
      refreshRemoteRunning();
    }
  });

  setInterval(() => {
    refreshRemoteRunning();
    maybeReconnect();
  }, POLL_MS);
  useStore.subscribe((state) => writeSessions(state.sessions));
}
