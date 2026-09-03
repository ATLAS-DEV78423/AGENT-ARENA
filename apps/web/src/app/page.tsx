"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { EmptyState } from "@/components/EmptyState";
import { ChatView } from "@/components/ChatView";
import { ArenaView } from "@/components/ArenaView";
import { CommandPalette } from "@/components/CommandPalette";
import { Settings } from "@/components/Settings";

export default function Home() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const arenaOpen = useStore((s) => s.arenaOpen);
  const openArena = useStore((s) => s.openArena);

  // Replace the static demo roster with whatever the server can actually run.
  useEffect(() => {
    void useStore.getState().refreshAgents();

    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        useStore.getState().openArena();
      } else if (key === ",") {
        e.preventDefault();
        useStore.getState().openSettings();
      } else if (key === "f") {
        e.preventDefault();
        useStore.getState().openCommandPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {activeSessionId ? (
            <ChatView />
          ) : arenaOpen ? (
            <ArenaView />
          ) : (
            <EmptyState onStartArena={() => openArena()} />
          )}
        </main>
      </div>

      <CommandPalette />
      <Settings />
    </div>
  );
}
