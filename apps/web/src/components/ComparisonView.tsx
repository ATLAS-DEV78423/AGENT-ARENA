"use client";

import { comparisonColumns } from "@/lib/comparison";
import type { Session } from "@/lib/types";
import { Markdown } from "./Markdown";
import { VerdictCard } from "./VerdictCard";

export function ComparisonView({ session }: { session: Session }) {
  const columns = comparisonColumns(session.messages);

  if (columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-muted">No agent responses to compare yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 items-start">
          {columns.map((column) => (
            <div
              key={column.agentId}
              className="rounded-xl border border-border-subtle bg-surface overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
                <span className="w-1.5 h-1.5 rounded-full bg-jade flex-shrink-0" />
                <span className="text-xs font-medium text-text-primary truncate">{column.agentName}</span>
              </div>
              <div className="p-3 space-y-3 max-h-[55vh] overflow-y-auto">
                {column.messages.map((m) => (
                  <div key={m.id}>
                    <p className="text-[10px] text-text-disabled mb-1">
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Markdown content={m.content} className="md-content-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <VerdictCard session={session} />
      </div>
    </div>
  );
}