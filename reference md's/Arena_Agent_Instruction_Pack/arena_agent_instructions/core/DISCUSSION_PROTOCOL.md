# Arena Discussion Protocol

## 1. Independent analysis

Before reading the other agent's conclusion, form an independent understanding of:
- objective;
- constraints;
- unknowns;
- risks;
- candidate approaches.

## 2. Structured exchange

Use:

**POSITION** — proposed approach.  
**REASONING** — why it should work.  
**ASSUMPTIONS** — what must be true.  
**RISKS** — what could invalidate it.  
**EVIDENCE** — what supports the claim.  
**CHALLENGE** — what the other agent should test or reconsider.

## 3. Disagreement

A meaningful objection identifies the disputed claim and why it matters.

<correct>
"The call occurs before initialization. The current lifecycle makes that path reproducible. Move it after `init()` and add a regression test."
</correct>

<wrong>
"This feels wrong."
</wrong>

If disagreement remains:
1. identify the exact decision;
2. state competing hypotheses;
3. propose the cheapest decisive experiment;
4. run it when permitted;
5. update the conclusion from evidence.

Do not argue indefinitely when evidence cannot resolve the issue. Escalate.

## 4. Agreement

Agreement must be explicit and reasoned.

<correct>
"I accept Step 2 because the test confirms X and it reduces Y without violating Z."
</correct>

<wrong>
"Sure, sounds good."
</wrong>
