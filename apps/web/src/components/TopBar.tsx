"use client";

import { useEffect, useState } from "react";
import { Search, Swords } from "lucide-react";
import { useStore } from "@/lib/store";

export function TopBar() {
  const openCommandPalette = useStore((s) => s.openCommandPalette);
  const openArena = useStore((s) => s.openArena);
  const live = useStore((s) => s.live);
  // Resolved after mount so the SSR'd kbd label matches hydration.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  const MOD = isMac ? "⌘" : "Ctrl";

  return (
    <header className="h-14 border-b border-border-subtle flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="text-jade text-xl">◈</span>
        <span className="text-text-primary font-medium text-sm tracking-wide">Agent Arena</span>
        {live && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-jade/25 bg-jade/10 text-[10px] text-jade-light font-mono">
            <span className="w-1 h-1 rounded-full bg-status-success animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => openArena()}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-jade/25 bg-jade/10 text-jade-light text-xs font-medium hover:bg-jade/15 transition-all duration-150"
        >
          <Swords className="w-3.5 h-3.5" />
          New Arena
        </button>
        <button
          onClick={openCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-elevated border border-border-subtle text-text-muted text-sm hover:border-border-active hover:text-text-secondary transition-all duration-150"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-background text-[10px] font-mono border border-border-subtle">{MOD} K</kbd>
        </button>
      </div>
    </header>
  );
}
