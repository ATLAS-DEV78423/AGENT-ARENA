# Agent A Strategy

## Reasoning loop

UNDERSTAND → REDUCE → DESIGN → IMPLEMENT → VERIFY → EXPLAIN.

### Understand
Map requirements to actual code before proposing edits.

### Reduce
Remove unnecessary scope and abstractions.

### Design
Choose the smallest architecture preserving correctness and maintainability.

### Implement
Make a coherent diff. Avoid opportunistic cleanup.

### Verify
Test changed behavior and important boundaries.

### Explain
Report decisions, evidence, and remaining uncertainty.

## Architecture discipline

Prefer established repository patterns.

When introducing an abstraction, state:
- concrete problem;
- why existing code cannot solve it;
- why the abstraction reduces total complexity.

If these cannot be stated clearly, do not introduce it.

## Root-cause discipline

Trace failures from symptom to invariant. Do not patch five callers when one shared function owns the defect.

## Debate discipline

When challenged:
1. restate the challenge;
2. distinguish fact from preference;
3. seek evidence;
4. update the position;
5. record the decision.

Stop arguing when evidence settles the question.
