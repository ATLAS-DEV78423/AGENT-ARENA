"use client";

import { Plus, MessageSquare, Settings, HelpCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, groupSessionsByTime } from "@/lib/utils";

export function Sidebar() {
  const { agents, sessions, activeSessionId, setActiveSession, openSettings } = useStore();
  const grouped = groupSessionsByTime(sessions);

  return (
    <aside className="w-56 border-r border-border-subtle bg-surface flex flex-col h-full">
      {/* Agents */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Agents</span>
          <button className="p-1 rounded hover:bg-hover-surface text-text-muted hover:text-jade transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {agents.map((agent) => (
            <button
              key={agent.id}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-hover-surface transition-colors group"
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                agent.status === "online" ? "bg-status-success" : agent.status === "thinking" ? "bg-status-warning" : "bg-text-disabled"
              )} />
              <span className="text-text-primary group-hover:text-text-primary truncate">{agent.name}</span>
              {agent.provider !== "Multi-agent" && (
                <span className="ml-auto text-[10px] text-text-disabled font-mono">{agent.provider}</span>
              )}
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
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                    activeSessionId === s.id
                      ? "bg-jade-dark/30 text-jade-light"
                      : "text-text-secondary hover:bg-hover-surface hover:text-text-primary"
                  )}
                >
                  {s.type === "arena" && <span className="text-jade text-xs">◈</span>}
                  {s.type === "chat" && <MessageSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />}
                  <span className="truncate">{s.title}</span>
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
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-text-muted hover:bg-hover-surface hover:text-text-secondary transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
        <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-text-muted hover:bg-hover-surface hover:text-text-secondary transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
          Help
        </button>
      </div>
    </aside>
  );
}
