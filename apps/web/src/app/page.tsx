"use client";

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
  const sessions = useStore((s) => s.sessions);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isArenaSession = activeSession?.type === "arena";

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {!activeSessionId ? (
            <EmptyState />
          ) : isArenaSession ? (
            <ChatView />
          ) : (
            <ChatView />
          )}
        </main>
      </div>

      <CommandPalette />
      <Settings />
    </div>
  );
}
