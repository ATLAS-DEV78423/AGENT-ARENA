"use client";

import { verdictMessage } from "@/lib/comparison";
import { buildVerdictCard } from "@/lib/verdict";
import type { Session } from "@/lib/types";

/**
 * The payoff card: the honest one-line outcome as its headline, plus — when
 * the run captured receipts — citations of what actually happened. Sessions
 * from before receipts existed degrade to the plain headline with no citations.
 */
export function VerdictCard({ session }: { session: Session }) {
  const verdict = verdictMessage(session.messages);
  const card = buildVerdictCard(session.receipts, verdict?.content ?? "");
  // No verdict yet (e.g. comparing mid-run) — nothing to pay off.
  if (!card.headline) return null;

  return (
    <div className="rounded-xl border border-jade/20 bg-jade/5 px-4 py-3">
      <p className="text-[10px] text-jade-light mb-1">VERDICT</p>
      <p className="text-[13px] leading-relaxed text-text-primary">{card.headline}</p>
      {card.citations.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-jade/15 pt-2">
          {card.citations.map((citation, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary"
            >
              <span className="text-jade-light/70 mt-0.5 flex-shrink-0">◈</span>
              {citation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
