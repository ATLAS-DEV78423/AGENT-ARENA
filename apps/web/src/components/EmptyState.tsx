"use client";

import { Plus, Swords } from "lucide-react";

export function EmptyState({ onStartArena }: { onStartArena: () => void }) {

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
      {/* Subtle jade glow */}
      <div className="relative mb-10">
        <div className="absolute inset-0 -m-10 bg-jade/5 rounded-full blur-3xl" />
        <span className="relative text-6xl text-jade/60 select-none">◈</span>
      </div>

      <h1 className="text-3xl font-light text-text-primary tracking-tight mb-3">Agent Arena</h1>
      <p className="text-base text-text-secondary mb-1">One question. Two minds.</p>
      <p className="text-sm text-text-muted mb-10 max-w-sm text-center leading-relaxed">
        Send one prompt to two agents. They analyse independently, challenge each other, build, and review —
        then you get an honest verdict.
      </p>

      <button
        onClick={onStartArena}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-jade/10 border border-jade/20 text-jade-light text-sm font-medium hover:bg-jade/15 hover:border-jade/30 transition-all duration-150"
      >
        <Swords className="w-4 h-4" />
        Start an Arena
      </button>
      <p className="mt-4 text-[11px] text-text-disabled flex items-center gap-1">
        <Plus className="w-3 h-3" />
        or press Ctrl N
      </p>
    </div>
  );
}
