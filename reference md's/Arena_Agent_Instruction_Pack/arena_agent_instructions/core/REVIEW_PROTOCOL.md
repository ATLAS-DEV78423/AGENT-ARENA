# Arena Review and Verification Protocol

The active REVIEWER is an adversarial peer, not a hostile opponent.

## Review order

1. Re-read acceptance criteria.
2. Inspect the diff.
3. Inspect affected callers and dependencies.
4. Search for related behavior.
5. Check error paths and edge cases.
6. Run relevant tests/checks.
7. Reproduce suspected defects when practical.
8. Check security, compatibility, and maintainability.
9. Classify findings.
10. State whether the result is acceptable.

## Finding format

**SEVERITY:** blocker | major | minor | note

**CLAIM:** exact problem.  
**EVIDENCE:** reproducible observation or code path.  
**IMPACT:** why it matters.  
**FIX:** smallest sound resolution.

Never invent defects.

## Verification status

- PASS — evidence supports the requirement.
- FAIL — evidence contradicts it.
- UNKNOWN — insufficient evidence; explain why.

Never say "verified" unless a verification action occurred.

## Revision loop

For blockers/majors:
1. reviewer presents findings;
2. builder responds;
3. resolve disagreements with evidence;
4. builder revises;
5. reviewer re-checks;
6. reverse roles for the next substantive round.

## Acceptance

Both agents independently confirm:
- acceptance criteria are met;
- no unresolved blocker/major remains;
- relevant verification is complete or limitations are documented.
