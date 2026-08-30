import { AgentResponse, AgentResponseKind } from "@arena/core";

// ponytail: keyword matching for response kind detection.
// Free models don't output exact keywords, so we match substrings.
const KIND_PATTERNS: Array<{ kind: AgentResponseKind; patterns: RegExp[] }> = [
  { kind: "plan_approved", patterns: [/plan.?approved/i, /approve.*plan/i, /i approve/i, /looks good.*plan/i, /agreed.*plan/i, /plan.*accept/i] },
  { kind: "plan_rejected", patterns: [/plan.?reject/i, /reject.*plan/i, /i reject/i, /disagree.*plan/i, /plan.*denied/i, /cannot.*approve/i] },
  { kind: "review_approved", patterns: [/review.?approved/i, /approve.*review/i, /looks good/i, /no.?findings/i, /pass.*review/i, /approved/i, /lgtm/i] },
  { kind: "review_rejected", patterns: [/finding/i, /bug/i, /issue/i, /problem/i, /error.*found/i, /reject/i, /fail/i, /review.*reject/i] },
  { kind: "final_approved", patterns: [/final.?approved/i, /approve.*final/i, /final.*ok/i, /ready.*ship/i, /all.*good/i, /ship it/i, /final.*accept/i] },
  { kind: "final_rejected", patterns: [/final.?reject/i, /reject.*final/i, /not.*ready/i, /hold/i, /block/i] },
  { kind: "finding", patterns: [/finding/i, /bug.*found/i, /issue.*found/i, /defect/i, /vulnerability/i, /problem.*found/i] },
];

export function parseResponseKind(content: string, context?: string): AgentResponseKind {
  const lower = content.toLowerCase();

  const hasProblemWords = /\b(issue|bug|problem|error|finding|defect|vulnerability|reject|fail|concern|risk|problematic|incomplete|missing|broken)\b/i.test(content);
  const hasApprovalWords = /\b(approved|looks good|lgtm|no.?findings|pass|accept|ship it|all.?good|agree)\b/i.test(content);

  // ponytail: if content has BOTH approval AND problem words, it's confused — treat as finding
  if (hasProblemWords && hasApprovalWords) return "finding";

  if (context) {
    const ctx = context.toLowerCase();
    if (ctx.includes("approve plan")) {
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "plan_approved" || kind === "plan_rejected") {
          for (const p of patterns) {
            if (p.test(content)) return kind;
          }
        }
      }
    }
    if (ctx.includes("review")) {
      // Check for problems first — if agent mentions issues, it's a finding
      if (hasProblemWords) return "finding";
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "review_approved") {
          for (const p of patterns) {
            if (p.test(content)) return kind;
          }
        }
      }
    }
    if (ctx.includes("final approval")) {
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "final_approved" || kind === "final_rejected") {
          for (const p of patterns) {
            if (p.test(content)) return kind;
          }
        }
      }
    }
  }

  // Fallback: check all patterns
  for (const { kind, patterns } of KIND_PATTERNS) {
    for (const p of patterns) {
      if (p.test(content)) return kind;
    }
  }

  // If no keyword found but content is very short and positive, treat as approved
  if (lower.length < 20 && (/^ok$|^yes$|^agree$|^approved$|^good$/i).test(lower)) {
    return "message"; // will be treated as positive
  }

  return "message";
}

export function buildResponse(content: string, context?: string): AgentResponse {
  const kind = parseResponseKind(content, context);
  return { kind, content };
}
