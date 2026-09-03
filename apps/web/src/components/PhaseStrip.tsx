"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Agent, Session } from "@/lib/types";

const STEP_LABELS = ["Analyse", "Discuss", "Plan", "Build", "Review", "Decide"] as const;

/** Orchestrator phase key → progress step (fixes are part of build). */
const STEP_INDEX: Record<string, number> = {
  analysis: 0,
  discussion: 1,
  plan: 2,
  build: 3,
  fix: 3,
  review: 4,
  final: 5,
};

const PHASE_LABELS: Record<string, string> = {
  starting: "Starting",
  analysis: "Independent analysis",
  discussion: "Discussion",
  plan: "Plan approval",
  build: "Building",
  fix: "Fixing",
  review: "Reviewing",
  final: "Final decision",
};

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function agentName(agentId: string, roster: Agent[]): string {
  return roster.find((a) => a.id === agentId)?.name ?? agentId;
}

export function PhaseStrip({ session, roster }: { session: Session; roster: Agent[] }) {
  const phase = session.phase;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!phase) return;
    const compute = () => Math.floor((Date.now() - phase.since) / 1000);
    setElapsed(compute());
    const timer = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(timer);
  }, [phase?.key, phase?.since]);

  if (!phase) return null;

  const activeStep = STEP_INDEX[phase.key] ?? -1;
  const label = PHASE_LABELS[phase.key] ?? phase.key;
  const thinking =
    phase.key === "starting"
      ? "Preparing the arena"
      : phase.agentName
        ? `${phase.agentName} is working`
        : "Agents are working";

  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3 mb-6">
      {/* Headline: phase + agent + elapsed */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-jade-light animate-pulse flex-shrink-0" />
        <span className="text-xs text-text-primary font-medium">{label}</span>
        <span className="text-xs text-text-muted truncate">{thinking}</span>
        <span className="ml-auto text-[11px] font-mono text-text-disabled flex-shrink-0 tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1 mt-2.5">
        {STEP_LABELS.map((stepLabel, i) => {
          const done = activeStep > i;
          const active = activeStep === i;
          return (
            <div key={stepLabel} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    active
                      ? "bg-jade-light animate-pulse"
                      : done
                        ? "bg-jade/60"
                        : "bg-text-disabled/40",
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-wide truncate",
                    active ? "text-jade-light" : done ? "text-text-muted" : "text-text-disabled/60",
                  )}
                >
                  {stepLabel}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1 mb-3",
                    done || active ? "bg-jade/30" : "bg-border-subtle",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Participants */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {session.agents.map((agentId) => {
          const name = agentName(agentId, roster);
          const active = !!phase.agentName && name === phase.agentName;
          return (
            <span
              key={agentId}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border",
                active
                  ? "bg-jade/10 border-jade/30 text-jade-light"
                  : "border-border-subtle text-text-muted",
              )}
            >
              <span
                className={cn(
                  "w-1 h-1 rounded-full",
                  active ? "bg-jade-light animate-pulse" : "bg-text-disabled/50",
                )}
              />
              {name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
