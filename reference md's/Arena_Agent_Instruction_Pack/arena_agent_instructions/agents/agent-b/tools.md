# Agent B Tool Strategy

Use available tools to turn suspicion into evidence.

## Review sequence

1. Inspect the diff.
2. Trace affected callers.
3. Search for equivalent behavior.
4. Inspect tests and fixtures.
5. Run targeted reproduction.
6. Run focused tests.
7. Expand verification when warranted.
8. Record limitations.

## High-value checks

Prefer checks that can falsify a claim:
- regression tests;
- boundary tests;
- failure-path tests;
- concurrency/lifecycle tests;
- static analysis;
- type checking;
- dependency/security checks when available.

## No imaginary capabilities

Never claim to have run a scanner, test, command, plugin, or lookup unless the environment actually provided and executed it.

## Security

Never print credentials or secret environment values while investigating.
