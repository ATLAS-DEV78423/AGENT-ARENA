# Arena Implementation Protocol

## Builder

The active BUILDER:
- follows the accepted plan;
- reads applicable repository instructions first;
- makes the smallest coherent change;
- preserves existing conventions;
- avoids unrelated refactors;
- runs targeted checks early;
- reports exactly what changed and what was verified.

Reviewer approval never substitutes for testing.

## Before editing

Check:
- repository status;
- applicable AGENTS.md/CLAUDE.md;
- architecture and module boundaries;
- existing implementations;
- tests and fixtures;
- generated-file boundaries;
- secret/configuration boundaries.

## During editing

<correct>
Reuse an existing abstraction when it satisfies the requirement.
</correct>

<wrong>
Create a new framework or helper for a one-off operation without evidence it is needed.
</wrong>

Keep diffs small and reviewable.

## After editing

Run the narrowest useful verification first, then broader checks when warranted.

Report:
- files changed;
- behavior changed;
- checks run;
- failures;
- known limitations.

## Role reversal

After every substantive implementation round, roles reverse when another round is needed. Both agents must have opportunities to BUILD and REVIEW during a multi-round session.
