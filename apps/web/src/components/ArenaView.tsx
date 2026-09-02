"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ArenaView() {
  const { agents, selectedAgentIds, toggleAgent, startArena } = useStore();
  const [prompt, setPrompt] = useState("");

  const availableAgents = agents.filter((a) => a.id !== "arena" && a.id !== "judge");

  const handleStart = () => {
    if (!prompt.trim() || selectedAgentIds.length === 0) return;
    startArena(selectedAgentIds, prompt.trim());
    setPrompt("");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-8">
      <div className="max-w-lg w-full text-center">
        <span className="text-3xl text-jade/60 mb-6 block">◈</span>
        <h2 className="text-lg font-light text-text-primary mb-1">Arena</h2>
        <p className="text-sm text-text-muted mb-8">Send one prompt to multiple agents. Compare. Decide.</p>

        {/* Agent selection */}
        <div className="mb-6">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Choose agents</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {availableAgents.map((agent) => {
              const selected = selectedAgentIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm border transition-all duration-150",
                    selected
                      ? "bg-jade/10 border-jade/30 text-jade-light"
                      : "bg-elevated border-border-subtle text-text-muted hover:border-border-active hover:text-text-secondary"
                  )}
                >
                  {agent.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt input */}
        <div className="relative mb-4">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="What should the agents work on?"
            className="w-full px-4 py-3 bg-elevated border border-border-subtle rounded-xl text-text-primary text-sm placeholder:text-text-muted outline-none focus:border-border-active transition-colors"
          />
        </div>

        <button
          onClick={handleStart}
          disabled={!prompt.trim() || selectedAgentIds.length === 0}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            prompt.trim() && selectedAgentIds.length > 0
              ? "bg-jade text-background hover:bg-jade-light"
              : "bg-elevated text-text-disabled border border-border-subtle cursor-not-allowed"
          )}
        >
          Run Arena
          <ArrowRight className="w-4 h-4" />
        </button>

        {selectedAgentIds.length > 0 && (
          <p className="text-[11px] text-text-disabled mt-3">
            {selectedAgentIds.length} agent{selectedAgentIds.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </div>
  );
}
