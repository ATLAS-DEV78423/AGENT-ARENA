"use client";

import { Message } from "@/lib/types";
import { Markdown } from "./Markdown";

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

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isJudge = message.role === "judge";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[80%]">
          <div className="inline-block bg-elevated border border-border-subtle rounded-2xl rounded-br-md px-4 py-2.5">
            <p className="text-text-primary text-[15px] leading-relaxed text-left whitespace-pre-wrap break-words">{message.content}</p>
          </div>
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
        <Markdown content={message.content} tone={isJudge ? "judge" : "default"} />
      </div>
    </div>
  );
}
