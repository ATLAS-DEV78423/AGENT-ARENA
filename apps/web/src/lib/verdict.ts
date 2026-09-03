import type { Receipt } from "./types";

export interface VerdictCard {
  headline: string;
  citations: string[];
}

function displaySeverity(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/**
 * Synthesizes a verdict card from the receipts captured during the run plus
 * the existing one-line outcome (the judge message). Deterministic — no model
 * call — and strictly factual: a citation is only ever the meaning of an
 * event that fired. No consensus line is fabricated when none was reached.
 */
export function buildVerdictCard(
  receipts: Receipt[] | undefined,
  headline: string,
): VerdictCard {
  const citations: string[] = [];
  for (const receipt of receipts ?? []) {
    switch (receipt.kind) {
      case "plan-approved":
        citations.push("Plan approved by both agents");
        break;
      case "plan-rejected":
        citations.push("Plan was rejected");
        break;
      case "deadlock":
        citations.push("Agents deadlocked on repeated objections");
        break;
      case "round":
        citations.push(
          `Round ${receipt.number} — ${receipt.builder} built · ${receipt.reviewer} reviewed`,
        );
        break;
      case "finding": {
        const by = receipt.agentName ? ` by ${receipt.agentName}` : "";
        citations.push(
          `${displaySeverity(receipt.severity)} finding${by}: "${receipt.claim}"`,
        );
        break;
      }
      case "consensus":
        citations.push("Both agents gave final approval");
        break;
    }
  }
  return { headline, citations };
}
