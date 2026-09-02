"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Message } from "@/lib/mock-data";
import { ChatComposer } from "./ChatComposer";

function AgentAvatar({ agentName, role }: { agentName?: string; role: string }) {
  const initials = agentName?.slice(0, 2) || (role === "user" ? "U" : "A");
  const isJudge = role === "judge";
  const isArena = role === "arena";

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
      isJudge ? "bg-jade/20 text-jade-light" :
      isArena ? "bg-jade-dark text-jade-light" :
      role === "user" ? "bg-elevated text-text-secondary" :
      "bg-hover-surface text-text-secondary"
    }`}>
      {isArena ? "◈" : initials}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isJudge = message.role === "judge";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[80%]">
          <p className="text-text-primary text-[15px] leading-relaxed text-right">{message.content}</p>
          <p className="text-[11px] text-text-disabled mt-1 text-right">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="pt-0.5">
        <AgentAvatar agentName={message.agentName} role={message.role} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-medium ${
            isJudge ? "text-jade-light" : "text-text-primary"
          }`}>
            {message.agentName || message.role}
          </span>
          {isJudge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-jade/10 text-jade border border-jade/20 font-medium">
              JUDGE
            </span>
          )}
          <span className="text-[11px] text-text-disabled">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${isJudge ? "text-jade-light/90" : "text-text-primary"}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

export function ChatView() {
  const { sessions, activeSessionId, sendMessage } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages.length]);

  if (!session) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="flex-shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h2 className="text-sm font-medium text-text-primary">{session.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {session.type === "arena" && (
                <span className="text-[10px] text-jade flex items-center gap-1">
                  <span className="text-xs">◈</span> Arena
                </span>
              )}
              <span className="text-[11px] text-text-disabled">
                {session.agents.length} agent{session.agents.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {session.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4">
        <ChatComposer onSend={sendMessage} />
      </div>
    </div>
  );
}
