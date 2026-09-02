import { AgentResponse, AgentResponseKind } from "@arena/core";

const KIND_PATTERNS: Array<{ kind: AgentResponseKind; patterns: RegExp[] }> = [
  { kind: "plan_approved", patterns: [/plan.?approved/i, /approve.*plan/i, /i approve/i, /agreed.*plan/i] },
  { kind: "plan_rejected", patterns: [/plan.?reject/i, /reject.*plan/i, /i reject/i, /disagree.*plan/i] },
  { kind: "review_approved", patterns: [/review.?approved/i, /approve.*review/i, /looks good/i, /no.?findings/i, /lgtm/i, /approved/i] },
  { kind: "review_rejected", patterns: [/finding/i, /bug/i, /issue/i, /problem/i, /error.*found/i, /reject/i, /fail/i] },
  { kind: "final_approved", patterns: [/final.?approved/i, /approve.*final/i, /final.*ok/i, /ready.*ship/i, /ship it/i] },
  { kind: "final_rejected", patterns: [/final.?reject/i, /reject.*final/i, /not.*ready/i, /hold/i, /block/i] },
  { kind: "finding", patterns: [/finding/i, /bug.*found/i, /issue.*found/i, /defect/i, /vulnerability/i] },
];

export function parseResponseKind(content: string, context?: string): AgentResponseKind {
  const hasProblemWords = /\b(issue|bug|problem|error|finding|defect|vulnerability|reject|fail|concern|risk|incomplete|missing|broken)\b/i.test(content);
  const hasApprovalWords = /\b(approved|looks good|lgtm|no.?findings|pass|accept|ship it|all.?good|agree)\b/i.test(content);

  if (hasProblemWords && hasApprovalWords) return "finding";

  if (context) {
    const ctx = context.toLowerCase();
    if (ctx.includes("approve plan")) {
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "plan_approved" || kind === "plan_rejected") {
          for (const p of patterns) { if (p.test(content)) return kind; }
        }
      }
    }
    if (ctx.includes("review")) {
      if (hasProblemWords) return "finding";
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "review_approved") {
          for (const p of patterns) { if (p.test(content)) return kind; }
        }
      }
    }
    if (ctx.includes("final approval")) {
      for (const { kind, patterns } of KIND_PATTERNS) {
        if (kind === "final_approved" || kind === "final_rejected") {
          for (const p of patterns) { if (p.test(content)) return kind; }
        }
      }
    }
  }

  for (const { kind, patterns } of KIND_PATTERNS) {
    for (const p of patterns) { if (p.test(content)) return kind; }
  }

  return "message";
}

export function buildResponse(content: string, context?: string): AgentResponse {
  const kind = parseResponseKind(content, context);
  return { kind, content };
}
