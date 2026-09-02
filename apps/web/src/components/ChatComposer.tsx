"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, ArrowUp, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (message: string) => void;
  showAgentSelector?: boolean;
}

export function ChatComposer({ onSend, showAgentSelector = false }: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { agents, selectedAgentIds, toggleAgent } = useStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [message]);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-shrink-0 pb-4 pt-2">
      <div
        className={cn(
          "relative bg-elevated rounded-2xl border transition-all duration-150",
          focused ? "border-border-active shadow-lg shadow-jade/5" : "border-border-subtle shadow-md shadow-black/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={showAgentSelector ? "Message Agent Arena..." : "Message..."}
          rows={1}
          className="w-full bg-transparent text-text-primary text-[15px] placeholder:text-text-muted px-4 pt-4 pb-12 resize-none outline-none leading-relaxed"
        />

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover-surface transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>

            {showAgentSelector && (
              <div className="relative">
                <button
                  onClick={() => setAgentsOpen(!agentsOpen)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-hover-surface transition-colors"
                >
                  <span className="text-jade">◈</span>
                  <span>{selectedAgentIds.length} agents</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {agentsOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-52 bg-elevated border border-border-subtle rounded-xl shadow-xl shadow-black/30 p-1.5 z-50">
                    {agents.filter((a) => a.id !== "arena").map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-hover-surface transition-colors"
                      >
                        <span className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center text-[10px]",
                          selectedAgentIds.includes(agent.id)
                            ? "bg-jade border-jade text-background"
                            : "border-border-subtle text-transparent"
                        )}>
                          {selectedAgentIds.includes(agent.id) && "✓"}
                        </span>
                        <div className="flex flex-col items-start">
                          <span className="text-text-primary">{agent.name}</span>
                          <span className="text-[10px] text-text-disabled">{agent.provider}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!message.trim()}
            className={cn(
              "p-2 rounded-xl transition-all duration-150",
              message.trim()
                ? "bg-jade text-background hover:bg-jade-light"
                : "text-text-disabled"
            )}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-text-disabled mt-2.5">
        Press <kbd className="px-1 py-0.5 rounded bg-elevated text-[10px] font-mono border border-border-subtle mx-0.5">Enter</kbd> to send
        <span className="mx-1.5">·</span>
        <kbd className="px-1 py-0.5 rounded bg-elevated text-[10px] font-mono border border-border-subtle mx-0.5">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
