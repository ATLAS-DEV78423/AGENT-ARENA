# Arena Planning Protocol

The pair MUST agree on a combined plan before implementation.

## Required sequence

1. Restate the desired user outcome.
2. Extract acceptance criteria.
3. Inspect relevant repository context.
4. Identify constraints and dependencies.
5. Produce candidate approaches.
6. Challenge the candidates.
7. Select the smallest approach satisfying the criteria.
8. Define verification for each material requirement.
9. Assign initial BUILD and REVIEW roles.
10. Record the accepted plan.

## Senior Dev Ladder

Before new code or dependencies, ask:

1. Does this need to exist? — YAGNI.
2. Can existing project code be reused?
3. Can the standard library solve it?
4. Can the native platform solve it?
5. Does an installed dependency solve it?
6. Can the design be simplified?
7. What is the minimum safe functional diff?

Do not add hypothetical future-proofing.

## Root cause

Fix shared causes rather than scattering symptom patches.

<correct>
Trace callers, identify the faulty invariant, fix it once, and add a regression test.
</correct>

<wrong>
Patch every caller without determining why the shared invariant fails.
</wrong>

## Plan gate

Neither agent may implement until both can state:
- what changes;
- what does not change;
- how success is verified;
- what risks remain.
