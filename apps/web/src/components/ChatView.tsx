"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { MessageBubble } from "./MessageBubble";
import { ComparisonView } from "./ComparisonView";
import { PhaseStrip } from "./PhaseStrip";
import { VerdictCard } from "./VerdictCard";
import { cn } from "@/lib/utils";

export function ChatView() {
  const { agents, sessions, activeSessionId, activeRunId, remoteRunning, openArena, startArena, markInterrupted } = useStore();
  const [view, setView] = useState<"transcript" | "compare">("transcript");
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages.length]);

  if (!session) return null;

  // Same seam the interrupted-banner Retry uses: a fresh arena with the same
  // agents and prompt streams through the normal lifecycle as a new session.
  const rerunPrompt = session.messages.find((m) => m.role === "user")?.content ?? session.title;
  const rerunnable = session.status === "completed" || session.status === "error";
  // Any running arena blocks new runs; for the interrupted banner, the stranded
  // session itself doesn't count (it is about to be retried, not streaming).
  const arenaRunning = sessions.some((s) => s.status === "running");
  const otherRunRunning = sessions.some(
    (s) => s.status === "running" && s.id !== session.id,
  );
  const rerun = () => startArena(session.agents, rerunPrompt);

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="flex-shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h2 className="text-sm font-medium text-text-primary">{session.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-jade flex items-center gap-1">
                <span className="text-xs">◈</span> Arena
              </span>
              {session.mode && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border",
                    session.mode === "live"
                      ? "text-jade-light border-jade/25 bg-jade/10"
                      : "text-text-muted border-border-subtle bg-elevated"
                  )}
                >
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      session.mode === "live" ? "bg-status-success" : "bg-text-disabled"
                    )}
                  />
                  {session.mode === "live" ? "Live agents" : "Demo"}
                </span>
              )}
              <span className="text-[11px] text-text-disabled">
                {session.agents.length} agent{session.agents.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rerunnable && (
              <>
                <button
                  onClick={rerun}
                  disabled={arenaRunning}
                  title={arenaRunning ? "An arena is already running" : "Run again with the same agents and prompt"}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors",
                    arenaRunning
                      ? "border-border-subtle text-text-disabled cursor-not-allowed"
                      : "border-jade/25 bg-jade/10 text-jade-light hover:bg-jade/15"
                  )}
                >
                  <RotateCcw className="w-3 h-3" />
                  Run again
                </button>
                <button
                  onClick={() => openArena(session.agents, rerunPrompt)}
                  disabled={arenaRunning}
                  title={
                    arenaRunning
                      ? "An arena is already running"
                      : "Reopen the setup with this prompt and agents to edit and rematch"
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors",
                    arenaRunning
                      ? "border-border-subtle text-text-disabled cursor-not-allowed"
                      : "border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-active"
                  )}
                >
                  <Pencil className="w-3 h-3" />
                  Rematch
                </button>
              </>
            )}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border-subtle">
              {(["transcript", "compare"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] transition-colors",
                    view === v
                      ? "bg-jade/15 text-jade-light"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {v === "transcript" ? "Transcript" : "Compare"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {view === "compare" ? (
        <ComparisonView session={session} />
      ) : (
        <>
      {/* Running-in-another-tab notice — the stream is live elsewhere, not lost */}
      {session.status === "running" && session.id !== activeRunId && remoteRunning.includes(session.id) && (
        <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-background">
            <p className="text-xs text-text-muted flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
              This arena is running in another tab — updates land here automatically.
            </p>
          </div>
        </div>
      )}

      {/* Interrupted notice — the page reloaded while this arena was streaming */}
      {session.status === "running" && session.id !== activeRunId && !remoteRunning.includes(session.id) && (
        <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-background">
            <p className="text-xs text-text-muted">
              This arena was interrupted — the page reloaded mid-run. The stream is gone.
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                disabled={otherRunRunning}
                title={otherRunRunning ? "An arena is already running" : undefined}
                onClick={() => {
                  // End the stranded session first so it never counts as running
                  // against the fresh arena the store is about to create.
                  markInterrupted(session.id);
                  startArena(
                    session.agents,
                    session.messages.find((m) => m.role === "user")?.content ?? session.title,
                  );
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  otherRunRunning
                    ? "bg-elevated text-text-disabled border border-border-subtle cursor-not-allowed"
                    : "bg-jade text-background hover:bg-jade-light"
                )}
              >
                Retry
              </button>
              <button
                onClick={() => markInterrupted(session.id)}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-text-secondary text-xs hover:text-text-primary transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {session.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {session.status === "running" && session.id === activeRunId && (
            <PhaseStrip session={session} roster={agents} />
          )}

          {session.status === "completed" && !!session.receipts?.length && (
            <VerdictCard session={session} />
          )}
        </div>
      </div>

      {/* New arena CTA — arena runs are one-shot; there is no follow-up chat */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4 pb-5">
        <button
          onClick={() => openArena()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border-subtle bg-elevated text-text-secondary text-sm hover:border-border-active hover:text-jade-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Run a new Arena
        </button>
      </div>
        </>
      )}
    </div>
  );
}
