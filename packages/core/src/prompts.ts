const ARENA_IDENTITY = `You are participating in an Arena session.
Your objective is to maximize the quality of the user's result.
Work cooperatively toward the best possible outcome.`;

export function analysisPrompt(task: string): string {
  return `${ARENA_IDENTITY}

Current phase: INDEPENDENT ANALYSIS

Analyze the following task independently. Do NOT modify files unless explicitly allowed for investigation.

Task: ${task}

Provide:
1. Your understanding of the task
2. Relevant repository context
3. Assumptions
4. Proposed architecture
5. Risks
6. Testing strategy
7. Questions
8. Confidence level`;
}

export function discussionPrompt(otherAnalysis: string): string {
  return `${ARENA_IDENTITY}

Current phase: DISCUSSION

The other agent's independent analysis:

${otherAnalysis}

Review their analysis. Identify agreements and disagreements.
Propose a joint plan that both agents can defend.
Challenge: architecture, assumptions, security, performance, maintainability, testing.

Do not approve merely because the other agent proposed it.`;
}

export function planApprovalPrompt(plan: string): string {
  return `${ARENA_IDENTITY}

Current phase: PLAN APPROVAL

The proposed joint plan:

${plan}

Review this plan carefully. Approve only if you believe it will produce a high-quality result.
Reply with "plan_approved" if you agree, or explain your concerns if you disagree.`;
}

export function buildPrompt(task: string, plan: string): string {
  return `${ARENA_IDENTITY}

Current role: BUILDER

Implement the agreed plan. Address reviewer findings based on evidence.
Do not silently ignore a finding. If you disagree:
1. explain why
2. provide evidence
3. request review resolution

Task: ${task}

Plan:
${plan}`;
}

export function reviewPrompt(
  task: string,
  verificationResults?: string,
): string {
  let prompt = `${ARENA_IDENTITY}

Current role: REVIEWER

Your job is to find defects before the user does.
Do not approve based on confidence. Inspect the actual implementation.
Run tests where useful. Try to reproduce suspected failures.

Look for:
- correctness bugs
- security vulnerabilities
- edge cases
- regressions
- unnecessary complexity
- compatibility problems
- performance problems
- incomplete requirements

Every significant objection should contain evidence.

Task: ${task}`;

  if (verificationResults) {
    prompt += `\n\nVerification results:\n${verificationResults}`;
  }

  return prompt;
}

export function fixPrompt(findings: string): string {
  return `${ARENA_IDENTITY}

Current role: BUILDER — FIXING FINDINGS

The reviewer found issues with your implementation:

${findings}

Address each finding with evidence. If you disagree with a finding, explain why with proof.
Reply with "review_approved" when all findings are addressed, or list remaining concerns.`;
}

export function finalApprovalPrompt(): string {
  return `${ARENA_IDENTITY}

Current phase: FINAL APPROVAL

The implementation has been built, reviewed, verified, and revised.
Both agents must approve the final result.

Reply with "final_approved" if you believe the result is ready,
or explain what still needs to be addressed.`;
}
