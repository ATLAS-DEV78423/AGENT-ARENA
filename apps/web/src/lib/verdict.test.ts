import { describe, it, expect } from "vitest";
import { buildVerdictCard } from "./verdict";
import type { Receipt } from "./types";

describe("buildVerdictCard", () => {
  it("cites plan approval, per-round roles, and consensus in order", () => {
    const receipts: Receipt[] = [
      { kind: "plan-approved" },
      { kind: "round", number: 1, builder: "Claude", reviewer: "GPT" },
      { kind: "consensus" },
    ];

    const card = buildVerdictCard(receipts, "The agents reached consensus after 1 round.");

    expect(card.headline).toBe("The agents reached consensus after 1 round.");
    expect(card.citations).toEqual([
      "Plan approved by both agents",
      "Round 1 — Claude built · GPT reviewed",
      "Both agents gave final approval",
    ]);
  });

  it("cites findings with severity, claim, and who filed them", () => {
    const receipts: Receipt[] = [
      { kind: "plan-approved" },
      { kind: "round", number: 1, builder: "Claude", reviewer: "GPT" },
      { kind: "finding", severity: "blocker", claim: "Missing null check in auth", agentName: "GPT" },
    ];

    const card = buildVerdictCard(receipts, "The arena ended without consensus.");

    expect(card.citations).toContain('Blocker finding by GPT: "Missing null check in auth"');
    // No consensus fabricated when the receipts never reached it
    expect(card.citations.some((c) => c.includes("final approval"))).toBe(false);
  });

  it("cites a plan rejection and a deadlock honestly", () => {
    const rejected = buildVerdictCard([{ kind: "plan-rejected" }], "ended without consensus");
    expect(rejected.citations).toContain("Plan was rejected");

    const deadlocked = buildVerdictCard([{ kind: "deadlock" }], "ended without consensus");
    expect(deadlocked.citations).toContain("Agents deadlocked on repeated objections");
  });

  it("degrades to the plain headline when there are no receipts", () => {
    const card = buildVerdictCard(undefined, "The agents reached consensus after 1 round.");
    expect(card.headline).toBe("The agents reached consensus after 1 round.");
    expect(card.citations).toEqual([]);
  });

  it("capitalizes finding severity for display", () => {
    const card = buildVerdictCard(
      [{ kind: "finding", severity: "minor", claim: "nit: spacing", agentName: "GPT" }],
      "verdict",
    );
    expect(card.citations[0]).toBe('Minor finding by GPT: "nit: spacing"');
  });
});
