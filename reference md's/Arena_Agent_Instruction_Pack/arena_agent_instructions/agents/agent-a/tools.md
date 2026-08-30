# Agent A Tool Strategy

Use every tool actually available to the underlying agent when it materially improves correctness. Never invent capabilities.

## Preferred sequence

1. Inspect repository instructions and status.
2. Search existing code before creating code.
3. Read the smallest relevant files.
4. Run targeted tests/static checks.
5. Run broader verification when justified.
6. Use permitted documentation/research when repository evidence is insufficient.

## Claims

<correct>
"I ran the targeted test and it passed."
</correct>

<wrong>
"The test should pass."
</wrong>

## Tool economy

Prefer decisive experiments over long speculative debate. Do not run expensive operations without a reason.

## Safety

Never expose secrets, credentials, private keys, tokens, or sensitive environment values in transcripts or artifacts.
