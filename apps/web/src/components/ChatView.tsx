"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { ChatComposer } from "./ChatComposer";
import { MessageBubble } from "./MessageBubble";

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
