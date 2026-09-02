"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Plus, ArrowRight, Settings, Keyboard, X } from "lucide-react";
import { useStore } from "@/lib/store";

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette, startArena, openSettings, sessions, setActiveSession } = useStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "new-arena", label: "New Arena", icon: <Plus className="w-4 h-4" />, action: () => { startArena(["claude", "gpt"], ""); closeCommandPalette(); } },
    { id: "new-chat", label: "New Conversation", icon: <Plus className="w-4 h-4" />, action: () => closeCommandPalette() },
    { id: "switch-agent", label: "Switch Agent", icon: <ArrowRight className="w-4 h-4" />, action: () => closeCommandPalette(), shortcut: "⌘A" },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, action: () => closeCommandPalette(), shortcut: "⌘/" },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" />, action: () => { openSettings(); closeCommandPalette(); }, shortcut: "⌘," },
    ...sessions.map((s) => ({
      id: `session-${s.id}`,
      label: s.title,
      icon: s.type === "arena" ? <span className="text-jade text-xs">◈</span> : <span className="text-text-muted">○</span>,
      action: () => { setActiveSession(s.id); closeCommandPalette(); },
    })),
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (commandPaletteOpen) closeCommandPalette();
        else useStore.getState().openCommandPalette();
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        closeCommandPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, closeCommandPalette]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[selectedIndex]?.action();
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeCommandPalette} />
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-md">
        <div className="bg-elevated border border-border-subtle rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
            <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Agent Arena..."
              className="flex-1 bg-transparent text-text-primary text-sm placeholder:text-text-muted outline-none"
            />
            <button onClick={closeCommandPalette} className="p-1 rounded text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-jade/10 text-jade-light"
                    : "text-text-secondary hover:bg-hover-surface hover:text-text-primary"
                }`}
              >
                <span className="flex-shrink-0">{cmd.icon}</span>
                <span className="flex-1 text-left">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-[10px] text-text-disabled font-mono px-1.5 py-0.5 rounded bg-background border border-border-subtle">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-text-muted py-6">No results found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
