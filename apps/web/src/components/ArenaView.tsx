"use client";

import { Fragment, useState } from "react";
import { ArrowRight, ArrowLeft, Swords, Sparkles } from "lucide-react";
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

  const ready = !arenaRunning && !!prompt.trim() && selectedAgentIds.length === 2;
  const firstUnselected = agents.find((a) => !selectedAgentIds.includes(a.id));

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-xl mx-auto px-4 py-10">
        <button
          onClick={closeArena}
          className="flex items-center gap-1.5 text-text-muted text-xs mb-8 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>

        {/* Headline */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 -m-6 bg-jade/10 rounded-full blur-2xl" />
            <span className="relative text-4xl text-jade/70 select-none block">◈</span>
          </div>
          <h2 className="text-2xl font-light text-text-primary tracking-tight mb-2">Start an Arena</h2>
          <p className="text-sm text-text-muted">
            Two minds. One prompt. They analyse, build, review each other, and report honestly.
          </p>
        </div>

        {/* Versus slots */}
        <div className="mb-8">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5 text-jade/70" />
            Pick the two combatants
          </p>
          {!live && (
            <p className="text-[11px] text-text-muted mb-3">
              No agent CLI on the server — this arena runs a scripted demo.
            </p>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
            {([["A", 0], ["B", 1]] as const).map(([slot, i]) => (
              <Fragment key={slot}>
                {i === 1 && (
                  <span
                    className="self-center text-xs font-mono text-jade/50 tracking-widest select-none px-1"
                    aria-hidden
                  >
                    VS
                  </span>
                )}
                {(() => {
                  const agent = agents.find((a) => a.id === selectedAgentIds[i]);
                  return agent ? (
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className="relative h-full px-4 py-3.5 rounded-2xl border border-jade/30 bg-jade/10 text-left transition-all duration-150 hover:border-jade/45"
                    >
                      <span className="absolute top-2.5 right-3 text-[10px] font-mono text-jade/60">{slot}</span>
                      <span className="block text-sm text-jade-light">{agent.name}</span>
                      <span className="block text-[10px] font-mono text-jade/60 mt-0.5">{agent.provider}</span>
                      <span className="block text-[10px] text-text-disabled mt-2">Click to clear</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => firstUnselected && toggleAgent(firstUnselected.id)}
                      disabled={!firstUnselected}
                      className="h-full px-4 py-3.5 rounded-2xl border border-dashed border-border-active/50 bg-elevated/40 text-left transition-all duration-150 hover:border-jade/30 hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm text-text-disabled">Empty slot {slot}</span>
                      <span className="block text-[10px] text-text-muted mt-2">
                        {firstUnselected ? `Click to fill with ${firstUnselected.name}` : "No agents available"}
                      </span>
                    </button>
                  );
                })()}
              </Fragment>
            ))}
          </div>

          {/* Roster chips */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {agents.map((agent) => {
              const selected = selectedAgentIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs transition-all duration-150",
                    selected
                      ? "bg-jade/15 border-jade/30 text-jade-light"
                      : "bg-elevated border-border-subtle text-text-secondary hover:border-border-active hover:text-text-primary",
                  )}
                >
                  {agent.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt input */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleStart();
            }
          }}
          placeholder="What should the agents work on?"
          rows={3}
          className="w-full px-4 py-3.5 bg-elevated border border-border-subtle rounded-2xl text-text-primary text-sm placeholder:text-text-muted outline-none focus:border-jade/40 transition-colors resize-none mb-3"
        />

        {!prompt.trim() && (
          <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-disabled flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Try:
            </span>
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
            "w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-150",
            ready
              ? "bg-jade text-background hover:bg-jade-light shadow-lg shadow-jade/10"
              : "bg-elevated text-text-disabled border border-border-subtle cursor-not-allowed",
          )}
        >
          Run Arena
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-3 min-h-[16px] text-center">
          {arenaRunning ? (
            <p className="text-[11px] text-text-disabled">An arena is already running — wait for it or dismiss it from its transcript.</p>
          ) : selectedAgentIds.length !== 2 ? (
            <p className="text-[11px] text-text-muted">
              {2 - selectedAgentIds.length === 1 ? "One more agent needed" : "Pick two agents"} — select from the roster; a third pick replaces the oldest.
            </p>
          ) : !prompt.trim() ? (
            <p className="text-[11px] text-text-muted">Describe the task, then run — the transcript streams every phase.</p>
          ) : (
            <p className="text-[11px] text-jade/70">Ready. The agents will analyse, discuss, and review each other.</p>
          )}
        </div>
      </div>
    </div>
  );
}
