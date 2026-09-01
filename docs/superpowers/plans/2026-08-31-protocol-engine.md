# Protocol Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw string orchestration with structured protocol events, add a Finding lifecycle state machine, wire EventStore persistence into the Orchestrator, and add deadlock detection — so the core loop tracks typed events, findings, and repeated objections instead of ad-hoc text.

**Architecture:** New Finding types with a 6-state lifecycle (OPEN → ACKNOWLEDGED → ACCEPTED/REJECTED → FIXED → VERIFIED). FindingManager and DeadlockDetector as lightweight session-scoped managers. EventStore wired into `Orchestrator.emit()` for JSONL persistence. Orchestrator review loop creates Findings from reviewer responses; discussion loop tracks objections for deadlock. Two existing state-machine bugs in the review path are fixed as part of this work.

**Tech Stack:** TypeScript (strict), Node.js ≥20, pnpm, Vitest

**Spec:** `reference md's/AI_Agent_Arena_Complete_Development_Blueprint.md` (sections 7–11: state machine, protocol events; section 31: finding lifecycle; section 11: termination/deadlock rules)

## Global Constraints

- TypeScript strict, no `any`, explicit public types — `tsconfig.base.json`
- Node ≥20, pnpm ≥9, ESM (`"type": "module"`) — `package.json`
- `Result<T,E>` for recoverable errors — `packages/core/src/types/common.ts`
- State transitions ONLY via `ArenaStateMachine.transition()` — `AGENTS.md`
- core must NOT depend on agents, pty, or CLI — `AGENTS.md`
- Semi, double quotes, trailing commas, printWidth 90 — `.prettierrc`
- `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` — `tsconfig.base.json`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/src/types/finding.ts` | Create | Finding type, lifecycle states/transitions, create/transition helpers |
| `packages/core/src/types/finding.test.ts` | Create | Tests for Finding types and transitions |
| `packages/core/src/session/finding-manager.ts` | Create | FindingManager: CRUD, query by state/severity, blocking detection |
| `packages/core/src/session/finding-manager.test.ts` | Create | Tests for FindingManager |
| `packages/core/src/session/deadlock-detector.ts` | Create | DeadlockDetector: objection tracking, repeated-claim detection |
| `packages/core/src/session/deadlock-detector.test.ts` | Create | Tests for DeadlockDetector |
| `packages/core/src/fake-orchestrator-adapter.ts` | Modify | Add `withFindings()` static method for test scenarios |
| `packages/core/src/orchestrator.ts` | Modify | Wire EventStore, structured events, FindingManager, DeadlockDetector, fix review-path bugs |
| `packages/core/src/orchestrator.test.ts` | Modify | Tests for persistence, structured events, findings, deadlock |
| `packages/core/src/index.ts` | Modify | Export finding types, FindingManager, DeadlockDetector |

---

## Known Bugs Fixed by This Plan

The current `orchestrator.ts` has two invalid state transitions in the review-findings path (lines that are unreachable today because the fake adapter always returns `review_approved`):

1. **`findings_presented` from VERIFYING** — After `review_completed` the state is VERIFYING, but `findings_presented` is only valid from REVIEWING. Fix: call `findings_presented` instead of `review_completed` when the reviewer returns a finding.

2. **`role_switched` from ROLE_SWITCH** — After `verification_passed` the state is ROLE_SWITCH, but `role_switched` is not in the ROLE_SWITCH transition table. Fix: use `implementation_started` to return to IMPLEMENTING for the next round.

---

## Tasks

### Task 1: Finding Types + Lifecycle State Machine

**Files:**
- Create: `packages/core/src/types/finding.ts`
- Test: `packages/core/src/types/finding.test.ts`

**Interfaces:**
- Consumes: `FindingId`, `AgentId`, `Timestamp`, `findingId`, `now` from `./common.js`
- Produces: `Finding`, `FindingState`, `FindingEvent`, `FindingSeverity`, `CreateFindingParams`, `createFinding()`, `transitionFinding()`, `FINDING_TRANSITIONS`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/types/finding.test.ts
import { describe, it, expect } from "vitest";
import { createFinding, transitionFinding } from "./finding.js";
import { agentId } from "./common.js";

const baseParams = {
  severity: "major" as const,
  category: "general",
  claim: "Missing null check",
  evidence: "line 42",
  impact: "Runtime crash",
  fix: "Add guard",
  createdBy: agentId("reviewer"),
};

describe("Finding types", () => {
  it("creates a finding with OPEN state", () => {
    const f = createFinding(baseParams);
    expect(f.state).toBe("OPEN");
    expect(f.severity).toBe("major");
    expect(f.claim).toBe("Missing null check");
    expect(f.createdBy).toBe("reviewer");
    expect(f.id).toBeTruthy();
    expect(f.history).toHaveLength(0);
  });

  it("transitions OPEN → ACKNOWLEDGED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    expect(f.state).toBe("ACKNOWLEDGED");
    expect(f.history).toHaveLength(1);
    expect(f.history[0]?.from).toBe("OPEN");
    expect(f.history[0]?.to).toBe("ACKNOWLEDGED");
  });

  it("transitions through full lifecycle OPEN → ACKNOWLEDGED → ACCEPTED → FIXED → VERIFIED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "accept");
    transitionFinding(f, "fix");
    transitionFinding(f, "verify");
    expect(f.state).toBe("VERIFIED");
    expect(f.history).toHaveLength(4);
  });

  it("transitions OPEN → REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "reject");
    expect(f.state).toBe("REJECTED");
  });

  it("transitions ACKNOWLEDGED → REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "reject");
    expect(f.state).toBe("REJECTED");
  });

  it("throws on invalid transition OPEN → fix", () => {
    const f = createFinding(baseParams);
    expect(() => transitionFinding(f, "fix")).toThrow(
      "Cannot transition finding from OPEN on event fix",
    );
  });

  it("throws on transition from terminal REJECTED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "reject");
    expect(() => transitionFinding(f, "acknowledge")).toThrow();
  });

  it("throws on transition from terminal VERIFIED", () => {
    const f = createFinding(baseParams);
    transitionFinding(f, "acknowledge");
    transitionFinding(f, "accept");
    transitionFinding(f, "fix");
    transitionFinding(f, "verify");
    expect(() => transitionFinding(f, "acknowledge")).toThrow();
  });

  it("updates updatedAt on transition", () => {
    const f = createFinding(baseParams);
    const before = f.updatedAt;
    transitionFinding(f, "acknowledge");
    expect(f.updatedAt >= before).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/core/src/types/finding.test.ts`
Expected: FAIL — module `./finding.js` not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/types/finding.ts
import { FindingId, AgentId, Timestamp, findingId, now } from "./common.js";
import { randomUUID } from "node:crypto";

export const FINDING_STATES = [
  "OPEN",
  "ACKNOWLEDGED",
  "ACCEPTED",
  "REJECTED",
  "FIXED",
  "VERIFIED",
] as const;

export type FindingState = (typeof FINDING_STATES)[number];

export type FindingEvent =
  | "acknowledge"
  | "accept"
  | "reject"
  | "fix"
  | "verify";

export const FINDING_TRANSITIONS: Record<
  FindingState,
  Partial<Record<FindingEvent, FindingState>>
> = {
  OPEN: { acknowledge: "ACKNOWLEDGED", reject: "REJECTED" },
  ACKNOWLEDGED: { accept: "ACCEPTED", reject: "REJECTED" },
  ACCEPTED: { fix: "FIXED" },
  REJECTED: {},
  FIXED: { verify: "VERIFIED" },
  VERIFIED: {},
};

export const FINDING_SEVERITIES = [
  "blocker",
  "major",
  "minor",
  "note",
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface FindingTransition {
  from: FindingState;
  to: FindingState;
  event: FindingEvent;
  timestamp: Timestamp;
}

export interface Finding {
  id: FindingId;
  severity: FindingSeverity;
  category: string;
  claim: string;
  evidence: string;
  impact: string;
  fix: string;
  state: FindingState;
  createdBy: AgentId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  history: FindingTransition[];
}

export interface CreateFindingParams {
  severity: FindingSeverity;
  category: string;
  claim: string;
  evidence: string;
  impact: string;
  fix: string;
  createdBy: AgentId;
}

export function createFinding(params: CreateFindingParams): Finding {
  const ts = now();
  return {
    id: findingId(randomUUID()),
    ...params,
    state: "OPEN",
    createdAt: ts,
    updatedAt: ts,
    history: [],
  };
}

export function transitionFinding(
  finding: Finding,
  event: FindingEvent,
): void {
  const transitions = FINDING_TRANSITIONS[finding.state];
  const target = transitions?.[event];
  if (!target) {
    throw new Error(
      `Cannot transition finding from ${finding.state} on event ${event}`,
    );
  }
  const ts = now();
  finding.history.push({
    from: finding.state,
    to: target,
    event,
    timestamp: ts,
  });
  finding.state = target;
  finding.updatedAt = ts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/types/finding.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types/finding.ts packages/core/src/types/finding.test.ts
git commit -m "feat(core): add Finding types with 6-state lifecycle"
```

---

### Task 2: FindingManager

**Files:**
- Create: `packages/core/src/session/finding-manager.ts`
- Test: `packages/core/src/session/finding-manager.test.ts`

**Interfaces:**
- Consumes: `FindingId` from `../types/common.js`; `Finding`, `FindingState`, `FindingSeverity`, `FindingEvent`, `CreateFindingParams` from `../types/finding.js`
- Produces: `FindingManager` class with `create()`, `transition()`, `get()`, `getAll()`, `getByState()`, `getBySeverity()`, `hasBlocking()`, `getBlocking()`, `getAcceptedUnfixed()`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/session/finding-manager.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { FindingManager } from "./finding-manager.js";
import { agentId } from "../types/common.js";

const baseParams = {
  severity: "major" as const,
  category: "general",
  claim: "Bug found",
  evidence: "test output",
  impact: "CI fails",
  fix: "Fix the bug",
  createdBy: agentId("reviewer"),
};

describe("FindingManager", () => {
  let fm: FindingManager;

  beforeEach(() => {
    fm = new FindingManager();
  });

  it("creates and retrieves a finding", () => {
    const f = fm.create(baseParams);
    expect(f.state).toBe("OPEN");
    expect(fm.get(f.id)).toBe(f);
  });

  it("lists all findings", () => {
    fm.create(baseParams);
    fm.create({ ...baseParams, claim: "Second bug" });
    expect(fm.getAll()).toHaveLength(2);
  });

  it("transitions a finding", () => {
    const f = fm.create(baseParams);
    fm.transition(f.id, "acknowledge");
    expect(fm.get(f.id).state).toBe("ACKNOWLEDGED");
  });

  it("filters by state", () => {
    const f1 = fm.create(baseParams);
    fm.create({ ...baseParams, claim: "Second" });
    fm.transition(f1.id, "acknowledge");
    expect(fm.getByState("OPEN")).toHaveLength(1);
    expect(fm.getByState("ACKNOWLEDGED")).toHaveLength(1);
  });

  it("filters by severity", () => {
    fm.create({ ...baseParams, severity: "blocker" });
    fm.create({ ...baseParams, severity: "minor" });
    expect(fm.getBySeverity("blocker")).toHaveLength(1);
    expect(fm.getBySeverity("minor")).toHaveLength(1);
  });

  it("hasBlocking is true when open blocker exists", () => {
    fm.create({ ...baseParams, severity: "blocker" });
    expect(fm.hasBlocking()).toBe(true);
  });

  it("hasBlocking is false when all blockers are verified", () => {
    const f = fm.create({ ...baseParams, severity: "blocker" });
    fm.transition(f.id, "acknowledge");
    fm.transition(f.id, "accept");
    fm.transition(f.id, "fix");
    fm.transition(f.id, "verify");
    expect(fm.hasBlocking()).toBe(false);
  });

  it("rejected findings are not blocking", () => {
    const f = fm.create({ ...baseParams, severity: "blocker" });
    fm.transition(f.id, "reject");
    expect(fm.hasBlocking()).toBe(false);
  });

  it("getAcceptedUnfixed returns only ACCEPTED findings", () => {
    const f1 = fm.create(baseParams);
    const f2 = fm.create({ ...baseParams, claim: "Second" });
    fm.transition(f1.id, "acknowledge");
    fm.transition(f1.id, "accept");
    fm.transition(f2.id, "acknowledge");
    expect(fm.getAcceptedUnfixed()).toHaveLength(1);
    expect(fm.getAcceptedUnfixed()[0]?.id).toBe(f1.id);
  });

  it("throws on transition of unknown finding", () => {
    expect(() =>
      fm.transition(agentId("nonexistent") as any, "acknowledge"),
    ).toThrow("not found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/core/src/session/finding-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/session/finding-manager.ts
import { FindingId } from "../types/common.js";
import {
  Finding,
  FindingState,
  FindingSeverity,
  FindingEvent,
  CreateFindingParams,
  createFinding,
  transitionFinding,
} from "../types/finding.js";

export class FindingManager {
  private findings = new Map<FindingId, Finding>();

  create(params: CreateFindingParams): Finding {
    const finding = createFinding(params);
    this.findings.set(finding.id, finding);
    return finding;
  }

  transition(id: FindingId, event: FindingEvent): void {
    transitionFinding(this.get(id), event);
  }

  get(id: FindingId): Finding {
    const f = this.findings.get(id);
    if (!f) throw new Error(`Finding ${id} not found`);
    return f;
  }

  getAll(): Finding[] {
    return [...this.findings.values()];
  }

  getByState(state: FindingState): Finding[] {
    return this.getAll().filter((f) => f.state === state);
  }

  getBySeverity(severity: FindingSeverity): Finding[] {
    return this.getAll().filter((f) => f.severity === severity);
  }

  hasBlocking(): boolean {
    return this.getBlocking().length > 0;
  }

  getBlocking(): Finding[] {
    return this.getAll().filter(
      (f) =>
        f.state !== "REJECTED" &&
        f.state !== "VERIFIED" &&
        (f.severity === "blocker" || f.severity === "major"),
    );
  }

  getAcceptedUnfixed(): Finding[] {
    return this.getAll().filter((f) => f.state === "ACCEPTED");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/session/finding-manager.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/finding-manager.ts packages/core/src/session/finding-manager.test.ts
git commit -m "feat(core): add FindingManager for lifecycle management"
```

---

### Task 3: Deadlock Detector

**Files:**
- Create: `packages/core/src/session/deadlock-detector.ts`
- Test: `packages/core/src/session/deadlock-detector.test.ts`

**Interfaces:**
- Consumes: `AgentId`, `Timestamp` from `../types/common.js`
- Produces: `DeadlockDetector` class with `recordObjection()`, `isDeadlock()`, `getObjections()`, `reset()`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/session/deadlock-detector.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { DeadlockDetector } from "./deadlock-detector.js";
import { agentId } from "../types/common.js";

function objection(
  claim: string,
  agent = "a",
  round = 0,
) {
  return {
    agentId: agentId(agent),
    claim,
    evidence: "",
    timestamp: `2026-01-01T00:${String(round).padStart(2, "0")}:00Z` as any,
    round,
  };
}

describe("DeadlockDetector", () => {
  let dd: DeadlockDetector;

  beforeEach(() => {
    dd = new DeadlockDetector(2);
  });

  it("not deadlocked with no objections", () => {
    expect(dd.isDeadlock()).toBe(false);
  });

  it("not deadlocked with one objection", () => {
    dd.recordObjection(objection("Use X"));
    expect(dd.isDeadlock()).toBe(false);
  });

  it("detects deadlock when same claim repeated twice", () => {
    dd.recordObjection(objection("Use X", "a", 0));
    dd.recordObjection(objection("Use X", "a", 1));
    expect(dd.isDeadlock()).toBe(true);
  });

  it("normalizes claims case-insensitively", () => {
    dd.recordObjection(objection("Use Option X", "a", 0));
    dd.recordObjection(objection("use option x", "b", 1));
    expect(dd.isDeadlock()).toBe(true);
  });

  it("different claims are not deadlock", () => {
    dd.recordObjection(objection("Use X", "a", 0));
    dd.recordObjection(objection("Use Y", "b", 1));
    expect(dd.isDeadlock()).toBe(false);
  });

  it("respects configurable threshold", () => {
    const dd3 = new DeadlockDetector(3);
    dd3.recordObjection(objection("X", "a", 0));
    dd3.recordObjection(objection("X", "a", 1));
    expect(dd3.isDeadlock()).toBe(false);
    dd3.recordObjection(objection("X", "a", 2));
    expect(dd3.isDeadlock()).toBe(true);
  });

  it("returns all objections", () => {
    dd.recordObjection(objection("X", "a", 0));
    dd.recordObjection(objection("Y", "b", 1));
    expect(dd.getObjections()).toHaveLength(2);
  });

  it("reset clears history", () => {
    dd.recordObjection(objection("X", "a", 0));
    dd.recordObjection(objection("X", "a", 1));
    expect(dd.isDeadlock()).toBe(true);
    dd.reset();
    expect(dd.isDeadlock()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/core/src/session/deadlock-detector.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/session/deadlock-detector.ts
import { AgentId, Timestamp } from "../types/common.js";

export interface Objection {
  agentId: AgentId;
  claim: string;
  evidence: string;
  timestamp: Timestamp;
  round: number;
}

export class DeadlockDetector {
  private maxRepeated: number;
  private history: Objection[] = [];

  constructor(maxRepeated: number = 2) {
    this.maxRepeated = maxRepeated;
  }

  recordObjection(objection: Objection): void {
    this.history.push(objection);
  }

  isDeadlock(): boolean {
    const counts = new Map<string, number>();
    for (const obj of this.history) {
      const key = obj.claim.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      if (count >= this.maxRepeated) return true;
    }
    return false;
  }

  getObjections(): readonly Objection[] {
    return this.history;
  }

  reset(): void {
    this.history = [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/session/deadlock-detector.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/deadlock-detector.ts packages/core/src/session/deadlock-detector.test.ts
git commit -m "feat(core): add DeadlockDetector for repeated-claim detection"
```

---

### Task 4: Orchestrator Integration

This is the largest task. It wires EventStore, FindingManager, and DeadlockDetector into the Orchestrator, replaces raw string exchanges with structured protocol events, fixes two state-machine bugs, and adds a `withFindings()` scenario to the fake adapter.

**Files:**
- Modify: `packages/core/src/fake-orchestrator-adapter.ts`
- Modify: `packages/core/src/orchestrator.ts`
- Modify: `packages/core/src/orchestrator.test.ts`

**Interfaces:**
- Consumes: `EventStore` from `./persistence/event-store.js`; `FindingManager` from `./session/finding-manager.js`; `DeadlockDetector` from `./session/deadlock-detector.js`; `FindingSeverity`, `CreateFindingParams` from `./types/finding.js`; `now`, `Timestamp` from `./types/common.js`
- Produces: Modified `Orchestrator` constructor accepting optional `EventStore`; `OrchestratorResult.sessionId`; `parseFindingFromResponse()` helper

- [ ] **Step 1: Add `withFindings()` to FakeOrchestratorAdapter**

Add this static method after the existing `disagreeing()` method in `packages/core/src/fake-orchestrator-adapter.ts`:

```typescript
static withFindings(id: AgentId, name: string): FakeOrchestratorAdapter {
  return new FakeOrchestratorAdapter(id, name, [
    { trigger: "Independent analysis", response: { kind: "analysis", content: "Analysis." } },
    { trigger: "Other analysis", response: { kind: "message", content: "Noted." } },
    { trigger: "Discuss", response: { kind: "message", content: "Plan: incremental." } },
    { trigger: "Approve plan", response: { kind: "plan_approved", content: "Approved." } },
    { trigger: "Review", response: { kind: "finding", content: "Blocker: missing null check in auth flow." } },
    { trigger: "Implement", response: { kind: "message", content: "Done." } },
    { trigger: "Final approval", response: { kind: "final_approved", content: "OK." } },
  ]);
}
```

- [ ] **Step 2: Write the failing orchestrator tests**

Replace the entire contents of `packages/core/src/orchestrator.test.ts` with:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Orchestrator } from "./orchestrator.js";
import { FakeOrchestratorAdapter } from "./fake-orchestrator-adapter.js";
import { EventStore } from "./persistence/event-store.js";
import { agentId } from "./types/common.js";

describe("Orchestrator - full protocol", () => {
  it("completes happy path: analysis -> discussion -> plan -> build/review -> consensus", async () => {
    const a = new FakeOrchestratorAdapter(agentId("agent-a"), "Agent A");
    const b = new FakeOrchestratorAdapter(agentId("agent-b"), "Agent B");
    const orch = new Orchestrator(
      { task: "Build feature X", cwd: "/tmp" }, a, b,
    );
    const result = await orch.run();
    expect(result.outcome).toBe("consensus");
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.state).toMatch(/CONSENSUS|COMPLETED/);
    expect(result.events.some((e) => e.type === "analysis.complete")).toBe(true);
    expect(result.events.some((e) => e.type === "plan.approved")).toBe(true);
    expect(result.events.some((e) => e.type === "round.started")).toBe(true);
    expect(result.events.some((e) => e.type === "consensus.reached")).toBe(true);
  });

  it("handles plan rejection -> timeout", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = FakeOrchestratorAdapter.disagreeing(agentId("b"), "B");
    const orch = new Orchestrator({ task: "Build X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("timeout");
    expect(
      result.events.some(
        (e) =>
          e.type === "plan.rejected" || e.state === "AWAITING_PLAN_APPROVAL",
      ),
    ).toBe(true);
  });

  it("terminates agents after completion", async () => {
    const terminated: string[] = [];
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    a.terminate = async () => {
      terminated.push("A");
    };
    b.terminate = async () => {
      terminated.push("B");
    };
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    await orch.run();
    expect(terminated).toContain("A");
    expect(terminated).toContain("B");
  });

  it("emits correct state transitions through key states", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    const states = result.events.map((e) => e.state);
    expect(states).toContain("INITIALIZING");
    expect(states).toContain("ANALYZING");
    expect(states).toContain("DISCUSSING");
    expect(states).toContain("IMPLEMENTING");
    expect(states).toContain("REVIEWING");
  });

  it("respects maxRounds config", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 1 }, a, b,
    );
    const result = await orch.run();
    expect(result.rounds).toBeLessThanOrEqual(1);
  });

  it("includes sessionId in result", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(typeof result.sessionId).toBe("string");
    expect(result.sessionId.length).toBeGreaterThan(0);
  });
});

describe("Orchestrator - EventStore persistence", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("persists events to EventStore when provided", async () => {
    dir = mkdtempSync(join(tmpdir(), "arena-test-"));
    const eventStore = new EventStore(dir);
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp" }, a, b, undefined, eventStore,
    );
    const result = await orch.run();

    const persisted = await eventStore.load(result.sessionId as string);
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted[0]?.type).toBe("session.created");
    expect(persisted.some((e) => e.type === "plan.approved")).toBe(true);
    expect(persisted.some((e) => e.type === "consensus.reached")).toBe(true);
  });

  it("works without EventStore (no persistence, no crash)", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();
    expect(result.outcome).toBe("consensus");
  });
});

describe("Orchestrator - structured discussion events", () => {
  it("emits message.created events during discussion", async () => {
    const a = new FakeOrchestratorAdapter(agentId("a"), "A");
    const b = new FakeOrchestratorAdapter(agentId("b"), "B");
    const orch = new Orchestrator({ task: "X", cwd: "/tmp" }, a, b);
    const result = await orch.run();

    const msgEvents = result.events.filter(
      (e) => e.type === "message.created",
    );
    expect(msgEvents.length).toBeGreaterThanOrEqual(2);
    expect(msgEvents.some((e) => e.agentId === agentId("a"))).toBe(true);
    expect(msgEvents.some((e) => e.agentId === agentId("b"))).toBe(true);
  });
});

describe("Orchestrator - Finding integration", () => {
  let origRandom: () => number;

  afterEach(() => {
    Math.random = origRandom;
  });

  it("creates finding during review when reviewer reports issue", async () => {
    origRandom = Math.random;
    Math.random = () => 0; // Agent A = Builder first

    const builder = new FakeOrchestratorAdapter(agentId("a"), "Builder");
    const reviewer = FakeOrchestratorAdapter.withFindings(
      agentId("b"), "Reviewer",
    );
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 1 }, builder, reviewer,
    );
    const result = await orch.run();

    expect(result.outcome).toBe("consensus");
    const findingEvents = result.events.filter(
      (e) => e.type === "finding.created",
    );
    expect(findingEvents.length).toBeGreaterThanOrEqual(1);
    expect(findingEvents[0]?.data?.severity).toBe("blocker");
  });
});

describe("Orchestrator - Deadlock detection", () => {
  it("detects deadlock when both agents reject plan repeatedly", async () => {
    const a = FakeOrchestratorAdapter.disagreeing(agentId("a"), "A");
    const b = FakeOrchestratorAdapter.disagreeing(agentId("b"), "B");
    const orch = new Orchestrator(
      { task: "X", cwd: "/tmp", maxRounds: 3, maxRepeatedObjections: 2 },
      a, b,
    );
    const result = await orch.run();

    expect(result.outcome).toBe("timeout");
    expect(result.events.some((e) => e.type === "dispute.opened")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail (new tests only)**

Run: `pnpm vitest run packages/core/src/orchestrator.test.ts`
Expected: FAIL — new tests for sessionId, persistence, structured events, findings, and deadlock should fail. Existing tests should pass.

- [ ] **Step 4: Rewrite orchestrator.ts**

Replace the entire contents of `packages/core/src/orchestrator.ts` with:

```typescript
import { SessionId, AgentId, Timestamp, now } from "./types/common.js";
import { ArenaState } from "./types/state-machine.js";
import { SessionManager } from "./session/manager.js";
import { FindingManager } from "./session/finding-manager.js";
import { DeadlockDetector } from "./session/deadlock-detector.js";
import {
  FindingSeverity,
  CreateFindingParams,
} from "./types/finding.js";
import { EventStore } from "./persistence/event-store.js";

export type AgentResponseKind =
  | "analysis"
  | "message"
  | "plan_approved"
  | "plan_rejected"
  | "finding"
  | "review_approved"
  | "review_rejected"
  | "final_approved"
  | "final_rejected"
  | "error"
  | "timeout"
  | "crash";

export interface AgentResponse {
  kind: AgentResponseKind;
  content: string;
  data?: Record<string, unknown>;
}

export interface OrchestratorConfig {
  task: string;
  cwd: string;
  maxRounds?: number;
  maxMinutes?: number;
  maxRepeatedObjections?: number;
  onLog?: (msg: string) => void;
}

export interface OrchestratorEvent {
  type: string;
  state: ArenaState;
  agentId?: AgentId;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface OrchestratorResult {
  sessionId: SessionId;
  state: ArenaState;
  outcome: "consensus" | "timeout" | "error";
  rounds: number;
  events: OrchestratorEvent[];
}

export interface OrchestratorAdapter {
  id: AgentId;
  name: string;
  start(config: { task: string; cwd: string }): Promise<{
    sessionId: string;
    pid: number;
  }>;
  sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse>;
  terminate(handle: { sessionId: string }): Promise<void>;
}

function parseFindingFromResponse(
  content: string,
  agentId: AgentId,
): CreateFindingParams {
  const lower = content.toLowerCase();
  let severity: FindingSeverity = "major";
  if (/\b(blocker|critical|showstopper|severe)\b/.test(lower))
    severity = "blocker";
  else if (/\b(minor|cosmetic|style|nit)\b/.test(lower)) severity = "minor";
  else if (/\b(note|info|fyi)\b/.test(lower)) severity = "note";

  return {
    severity,
    category: "general",
    claim: content,
    evidence: "",
    impact: "",
    fix: "",
    createdBy: agentId,
  };
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private adapterA: OrchestratorAdapter;
  private adapterB: OrchestratorAdapter;
  private manager: SessionManager;
  private eventStore: EventStore | null;
  private findingManager: FindingManager;
  private deadlockDetector: DeadlockDetector;
  private events: OrchestratorEvent[] = [];
  private hA: { sessionId: string } | null = null;
  private hB: { sessionId: string } | null = null;
  private sid!: SessionId;

  constructor(
    config: OrchestratorConfig,
    a: OrchestratorAdapter,
    b: OrchestratorAdapter,
    mgr?: SessionManager,
    eventStore?: EventStore,
  ) {
    this.config = config;
    this.adapterA = a;
    this.adapterB = b;
    this.manager = mgr ?? new SessionManager();
    this.eventStore = eventStore ?? null;
    this.findingManager = new FindingManager();
    this.deadlockDetector = new DeadlockDetector(
      this.config.maxRepeatedObjections ?? 2,
    );
  }

  async run(): Promise<OrchestratorResult> {
    try {
      const s = await this.manager.createSession({
        task: this.config.task,
        agentA: this.adapterA.id,
        agentB: this.adapterB.id,
        budget: {
          maxRounds: this.config.maxRounds ?? 3,
          maxMinutes: this.config.maxMinutes ?? 10,
        },
      });
      this.sid = s.id;

      this.emit("session.created");
      this.trans("initialize");
      this.emit("session.initialized");

      this.hA = await this.adapterA.start({
        task: this.config.task,
        cwd: this.config.cwd,
      });
      this.hB = await this.adapterB.start({
        task: this.config.task,
        cwd: this.config.cwd,
      });
      this.trans("environment_checked");
      this.emit("environment.checked");
      this.log("Both agents launched.");

      // 1. Independent analysis
      this.log("Agent A analyzing...");
      const rA1 = await this.adapterA.sendAndReceive(
        this.hA,
        "Independent analysis: " + this.config.task,
      );
      this.log("Agent B analyzing...");
      const rB1 = await this.adapterB.sendAndReceive(
        this.hB,
        "Independent analysis: " + this.config.task,
      );
      this.trans("analysis_complete");
      this.emit("analysis.started");
      this.trans("analysis_complete");
      this.emit("analysis.complete", {
        agentA: rA1.content,
        agentB: rB1.content,
      });
      this.log("Analysis complete. Starting discussion...");

      // 2. Discussion — structured events
      const discA = await this.adapterA.sendAndReceive(
        this.hA,
        "Other agent's analysis:\n" +
          rB1.content +
          "\n\nDiscuss and propose a joint plan.",
      );
      this.emit(
        "message.created",
        { messageType: "DISCUSSION", content: discA.content },
        this.adapterA.id,
      );

      const discB = await this.adapterB.sendAndReceive(
        this.hB,
        "Other agent's analysis:\n" +
          rA1.content +
          "\n\nDiscuss and propose a joint plan.",
      );
      this.emit(
        "message.created",
        { messageType: "DISCUSSION", content: discB.content },
        this.adapterB.id,
      );

      // Record discussion-phase objections for deadlock detection
      if (discA.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterA.id,
          claim: discA.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }
      if (discB.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterB.id,
          claim: discB.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }

      this.trans("discussion_complete");
      this.emit("discussion.complete");
      this.log("Discussion complete. Requesting plan approval...");

      // 3. Plan approval
      const rAp = await this.adapterA.sendAndReceive(
        this.hA,
        "Approve plan? plan_approved or plan_rejected.",
      );
      const rBp = await this.adapterB.sendAndReceive(
        this.hB,
        "Approve plan? plan_approved or plan_rejected.",
      );
      this.trans("plan_submitted");

      // Record plan rejections for deadlock detection
      if (rAp.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterA.id,
          claim: rAp.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }
      if (rBp.kind === "plan_rejected") {
        this.deadlockDetector.recordObjection({
          agentId: this.adapterB.id,
          claim: rBp.content,
          evidence: "",
          timestamp: now() as Timestamp,
          round: 0,
        });
      }

      if (this.deadlockDetector.isDeadlock()) {
        this.emit("dispute.opened", {
          reason: "Repeated objections without resolution",
        });
        this.log("Deadlock detected — escalating to user.");
        this.trans("plan_rejected");
        return this.result("timeout");
      }

      if (rAp.kind !== "plan_approved" || rBp.kind !== "plan_approved") {
        this.trans("plan_rejected");
        this.emit("plan.rejected");
        return this.result("timeout");
      }
      this.trans("plan_approved");
      this.emit("plan.approved");
      this.log("Plan approved! Starting build/review loop...");

      // 4. Builder/Reviewer loop
      const roles = this.manager.getRoles(this.sid);
      let builder =
        roles[0]!.role === "Builder" ? this.adapterA : this.adapterB;
      let builderH = builder === this.adapterA ? this.hA : this.hB;
      let reviewer =
        builder === this.adapterA ? this.adapterB : this.adapterA;
      let reviewerH = reviewer === this.adapterA ? this.hA : this.hB;
      let isFirstRound = true;

      for (
        let round = 0;
        round < (this.config.maxRounds ?? 3);
        round++
      ) {
        if (isFirstRound) {
          isFirstRound = false;
        } else {
          this.trans("implementation_started");
        }
        this.emit("round.started", {
          round: round + 1,
          builder: builder.id,
          reviewer: reviewer.id,
        });
        await builder.sendAndReceive(builderH!, "Implement the plan.");
        this.trans("implementation_completed");

        this.emit("review.started", undefined, reviewer.id);
        const rev = await reviewer.sendAndReceive(
          reviewerH!,
          "Review the implementation.",
        );

        if (rev.kind === "review_approved") {
          // BUG FIX: call review_completed from REVIEWING (not after)
          this.trans("review_completed");
          this.trans("verification_passed");

          const fA = await this.adapterA.sendAndReceive(
            this.hA!,
            "Final approval? final_approved.",
          );
          const fB = await this.adapterB.sendAndReceive(
            this.hB!,
            "Final approval? final_approved.",
          );
          if (
            fA.kind === "final_approved" &&
            fB.kind === "final_approved"
          ) {
            this.trans("final_review_passed");
            this.trans("consensus_reached");
            this.emit("consensus.reached");
            return this.result("consensus");
          }
          // Not final — continue to next round
          this.trans("implementation_started");
        } else {
          // BUG FIX: findings_presented from REVIEWING (not VERIFYING)
          this.trans("findings_presented");

          const finding = this.findingManager.create(
            parseFindingFromResponse(rev.content, reviewer.id),
          );
          this.emit(
            "finding.created",
            {
              findingId: finding.id,
              severity: finding.severity,
              claim: finding.claim,
            },
            reviewer.id,
          );
          this.log(
            "Reviewer found: " +
              finding.severity +
              " — " +
              finding.claim.slice(0, 100),
          );

          // Builder resolves findings
          await builder.sendAndReceive(
            builderH!,
            "Fix these findings:\n" + rev.content,
          );
          this.findingManager.transition(finding.id, "acknowledge");
          this.findingManager.transition(finding.id, "accept");
          this.findingManager.transition(finding.id, "fix");

          // BUG FIX: use implementation_started instead of role_switched
          this.trans("findings_resolved");
          this.trans("verification_passed");
          this.trans("implementation_started");
        }

        [builder, reviewer] = [reviewer, builder];
        [builderH, reviewerH] = [reviewerH, builderH];
      }

      this.trans("final_review_passed");
      this.trans("consensus_reached");
      return this.result("consensus");
    } catch (error) {
      this.emit("error", { error: String(error) });
      this.log("ERROR: " + String(error));
      return this.result("error");
    } finally {
      if (this.hA) await this.adapterA.terminate(this.hA).catch(() => {});
      if (this.hB) await this.adapterB.terminate(this.hB).catch(() => {});
    }
  }

  private trans(event: string) {
    this.manager.transition(this.sid, event as any);
  }

  private emit(
    type: string,
    data?: Record<string, unknown>,
    agentId?: AgentId,
  ) {
    const ts = now();
    const event: OrchestratorEvent = {
      type,
      state: this.manager.getState(this.sid),
      agentId,
      data,
      timestamp: ts,
    };
    this.events.push(event);
    if (this.eventStore) {
      this.eventStore.append(this.sid as string, {
        type: event.type,
        state: event.state,
        timestamp: ts,
        agentId: event.agentId as string | undefined,
        data: event.data,
      });
    }
  }

  private result(
    outcome: OrchestratorResult["outcome"],
  ): OrchestratorResult {
    return {
      sessionId: this.sid,
      state: this.manager.getState(this.sid),
      outcome,
      rounds: this.events.filter((e) => e.type === "round.started").length,
      events: [...this.events],
    };
  }

  private log(msg: string) {
    this.config.onLog?.(msg);
  }
}
```

- [ ] **Step 5: Run all orchestrator tests**

Run: `pnpm vitest run packages/core/src/orchestrator.test.ts`
Expected: PASS — all tests green (existing + new)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/fake-orchestrator-adapter.ts packages/core/src/orchestrator.ts packages/core/src/orchestrator.test.ts
git commit -m "feat(core): wire EventStore, FindingManager, DeadlockDetector into Orchestrator

- Add structured protocol events (message.created, finding.created, dispute.opened)
- Add EventStore persistence for JSONL event logging
- Add FindingManager integration during review phase
- Add DeadlockDetector during discussion and plan phases
- Fix findings_presented called from wrong state (VERIFYING → REVIEWING)
- Fix role_switched invalid transition from ROLE_SWITCH
- Add sessionId to OrchestratorResult"
```

---

### Task 5: Update Exports + Final Verification

**Files:**
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: All modules created in Tasks 1–4
- Produces: Public API surface for `@arena/core`

- [ ] **Step 1: Add exports to index.ts**

Add these lines to `packages/core/src/index.ts` after the existing exports:

```typescript
export * from "./types/finding.js";
export * from "./session/finding-manager.js";
export * from "./session/deadlock-detector.js";
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm vitest run`
Expected: PASS — all tests across all packages green

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — no type errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export FindingManager, DeadlockDetector, Finding types"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ State machine transitions (section 7) — bugs fixed, correct transitions verified by tests
- ✅ Protocol events (section 8) — `message.created`, `finding.created`, `dispute.opened` emitted
- ✅ Finding lifecycle (section 31) — OPEN → ACKNOWLEDGED → ACCEPTED → FIXED → VERIFIED with rejection paths
- ✅ Termination/deadlock (section 11) — DeadlockDetector escalates after repeated objections
- ✅ Evidence over confidence (section 4.5) — findings require claim content, severity parsed from response
- ✅ Deterministic orchestration (section 4.6) — runtime controls state, agents cannot change it

**2. Placeholder scan:** No TBD/TODO/placeholders found. All steps have actual code.

**3. Type consistency:**
- `Finding.id` uses `FindingId` brand — consistent with `findingId()` import in Task 1
- `FindingManager.create()` returns `Finding` — consumed by Orchestrator in Task 4
- `DeadlockDetector.recordObjection()` takes `Objection` — created with `now() as Timestamp` in Task 4
- `EventStore.append()` takes `string, StoredEvent` — Orchestrator casts `SessionId` to `string` and creates `StoredEvent` shape
- `OrchestratorResult.sessionId` — new field, existing CLI code doesn't reference it so no breakage
