"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Draft a two-line mission statement for a local-first notes app",
  "Which database fits a small team shipping an offline-first sync app?",
];

export function ArenaView() {
  const { agents, live, selectedAgentIds, toggleAgent, startArena, closeArena, sessions } = useStore();
  // Seeded from the store's draft (set by Rematch) — the view mounts fresh on
  // every open, so reading once here is the whole handoff.
  const [prompt, setPrompt] = useState(() => useStore.getState().arenaDraftPrompt);
  const arenaRunning = sessions.some((s) => s.status === "running");

  const handleStart = () => {
    // The server contract is exactly two minds — analysis is A/B and rounds are
    // builder/reviewer, so an arena never takes more.
    if (arenaRunning || !prompt.trim() || selectedAgentIds.length !== 2) return;
    startArena(selectedAgentIds, prompt.trim());
    setPrompt("");
  };

  const ready = !arenaRunning && prompt.trim() && selectedAgentIds.length === 2;

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-8">
      <div className="max-w-lg w-full text-center">
        <button onClick={closeArena} className="flex items-center gap-1 text-text-muted text-xs mb-4 hover:text-text-secondary transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <span className="text-3xl text-jade/60 mb-6 block">◈</span>
        <h2 className="text-lg font-light text-text-primary mb-1">Arena</h2>
        <p className="text-sm text-text-muted mb-8">Send one prompt to multiple agents. Compare. Decide.</p>

        {/* Agent selection */}
        <div className="mb-6">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Choose agents</p>
          {!live && (
            <p className="text-[11px] text-text-muted mb-3">
              No agent CLI on the server — this arena runs a scripted demo.
            </p>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {agents.map((agent) => {
              const selected = selectedAgentIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-left transition-all duration-150",
                    selected
                      ? "bg-jade/10 border-jade/30"
                      : "bg-elevated border-border-subtle hover:border-border-active"
                  )}
                >
                  <span className={cn("block text-sm leading-tight", selected ? "text-jade-light" : "text-text-secondary")}>
                    {agent.name}
                  </span>
                  <span className={cn("block text-[10px] leading-tight mt-0.5 font-mono", selected ? "text-jade/70" : "text-text-disabled")}>
                    {agent.provider}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt input */}
        <div className="relative mb-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="What should the agents work on?"
            className="w-full px-4 py-3 bg-elevated border border-border-subtle rounded-xl text-text-primary text-sm placeholder:text-text-muted outline-none focus:border-border-active transition-colors"
          />
        </div>

        {!prompt.trim() && (
          <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-disabled">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="px-2.5 py-1 rounded-full border border-border-subtle bg-background text-[11px] text-text-muted hover:text-jade-light hover:border-jade/30 transition-colors max-w-full truncate"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!ready}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            ready
              ? "bg-jade text-background hover:bg-jade-light"
              : "bg-elevated text-text-disabled border border-border-subtle cursor-not-allowed"
          )}
        >
          Run Arena
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-3 min-h-[16px]">
          {arenaRunning ? (
            <p className="text-[11px] text-text-disabled">An arena is already running — wait for it or dismiss it from its transcript.</p>
          ) : selectedAgentIds.length !== 2 ? (
            <p className="text-[11px] text-text-disabled">An arena runs between exactly two agents — select two to compare.</p>
          ) : !prompt.trim() ? (
            <p className="text-[11px] text-text-muted">Describe the task, then run — the agents analyse, discuss, and review each other in the transcript.</p>
          ) : (
            <p className="text-[11px] text-text-muted">{selectedAgentIds.length} agents ready. The run streams to a transcript, then you can compare side by side.</p>
          )}
        </div>
      </div>
    </div>
  );
}
