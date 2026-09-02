"use client";

import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";

export function EmptyState() {
  const startArena = useStore((s) => s.startArena);
  const selectedAgentIds = useStore((s) => s.selectedAgentIds);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
      {/* Subtle jade glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 -m-8 bg-jade/5 rounded-full blur-3xl" />
        <span className="relative text-5xl text-jade/60 select-none">◈</span>
      </div>

      <h1 className="text-2xl font-light text-text-primary tracking-tight mb-2">Agent Arena</h1>
      <p className="text-sm text-text-secondary mb-1">One question. Multiple minds.</p>
      <p className="text-sm text-text-muted mb-8 max-w-xs text-center">Compare agents, evaluate responses, and find the strongest answer.</p>

      <button
        onClick={() => startArena(selectedAgentIds, "What should we build?")}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jade/10 border border-jade/20 text-jade-light text-sm font-medium hover:bg-jade/15 hover:border-jade/30 transition-all duration-150"
      >
        <Plus className="w-4 h-4" />
        Start an Arena
      </button>
    </div>
  );
}
