"use client";

import { Plus, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, groupSessionsByTime } from "@/lib/utils";

export function Sidebar() {
  const { agents, sessions, activeSessionId, setActiveSession, openSettings, openArena } = useStore();
  const grouped = groupSessionsByTime(sessions);

  return (
    <aside className="w-60 border-r border-border-subtle bg-surface flex flex-col h-full">
      {/* New Arena */}
      <div className="p-3">
        <button
          onClick={() => openArena()}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-xl bg-jade/10 border border-jade/20 text-sm text-jade-light font-medium hover:bg-jade/15 hover:border-jade/30 transition-all duration-150 mb-3"
        >
          <Plus className="w-4 h-4" />
          New Arena
        </button>
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-2">Agents</span>
        <div className="space-y-0.5">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => openArena([agent.id])}
              title={`Run an arena with ${agent.name}`}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm hover:bg-hover-surface transition-colors group"
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                agent.status === "online" ? "bg-status-success" : agent.status === "thinking" ? "bg-status-warning" : "bg-text-disabled"
              )} />
              <span className="text-text-primary truncate">{agent.name}</span>
              <span className="ml-auto text-[10px] text-text-disabled font-mono">{agent.provider}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto p-3 pt-0">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-2">Sessions</span>

        {([
          { label: "Today", items: grouped.today },
          { label: "Yesterday", items: grouped.yesterday },
          { label: "Previous 7 days", items: grouped.older },
        ]).map(({ label, items }) =>
          items.length > 0 && (
            <div key={label} className="mb-3">
              <span className="text-[10px] text-text-disabled mb-1 block">{label}</span>
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left",
                    activeSessionId === s.id
                      ? "bg-jade-dark/40 text-jade-light"
                      : "text-text-secondary hover:bg-hover-surface hover:text-text-primary"
                  )}
                >
                  <span className="text-jade text-xs flex-shrink-0">◈</span>
                  <span className="truncate">{s.title}</span>
                  {s.status === "interrupted" && (
                    <span className="ml-auto text-[10px] text-text-disabled flex-shrink-0">interrupted</span>
                  )}
                  {s.status === "error" && (
                    <span className="ml-auto text-[10px] text-status-error/80 flex-shrink-0">failed</span>
                  )}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Bottom */}
      <div className="p-3 border-t border-border-subtle space-y-0.5">
        <button
          onClick={openSettings}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-text-muted hover:bg-hover-surface hover:text-text-secondary transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </aside>
  );
}
