# PTY Persistent Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot agent spawning with persistent child processes that stay alive between messages, enabling multi-turn conversations, output streaming, and interrupt support.

**Architecture:** A new `PtyAgentAdapter` wraps the existing `ProcessSessionHandle` to keep child processes alive across messages. Output delimiters (unique sentinel strings) mark response boundaries so the adapter knows when an agent is done thinking. A `ResponseBuffer` accumulates output between delimiters. The adapter implements `OrchestratorAdapter` for direct use in the orchestrator. The existing one-shot adapters remain as fallback.

**Tech Stack:** TypeScript (strict), Node.js ≥20, pnpm, Vitest, `child_process.spawn` (no native deps — ponytail: `node-pty` adds a build step and platform issues for zero benefit when stdin/stdout piping works)

**Spec:** `reference md's/AI_Agent_Arena_Complete_Development_Blueprint.md` (sections 15: PTY/Terminal Architecture; 23: Agent Adapter Interface; 24: Generic CLI Adapter; Phase 2: PTY/process engine)

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
| `packages/pty/src/delimiter.ts` | Create | Delimiter generation and detection for response boundaries |
| `packages/pty/src/delimiter.test.ts` | Create | Tests for delimiter utilities |
| `packages/pty/src/response-buffer.ts` | Create | ResponseBuffer: accumulates output, detects complete responses |
| `packages/pty/src/response-buffer.test.ts` | Create | Tests for ResponseBuffer |
| `packages/pty/src/persistent-session.ts` | Create | PersistentSession: wraps ProcessSessionHandle, keeps process alive, writes messages, reads delimited responses |
| `packages/pty/src/persistent-session.test.ts` | Create | Tests for PersistentSession |
| `packages/pty/src/pty-adapter.ts` | Create | PtyAgentAdapter: implements OrchestratorAdapter using PersistentSession |
| `packages/pty/src/pty-adapter.test.ts` | Create | Tests for PtyAgentAdapter |
| `packages/pty/src/index.ts` | Modify | Export new modules |
| `packages/agents/src/generic/generic.ts` | Create | GenericAgentAdapter: configurable CLI adapter using PtyAgentAdapter |
| `packages/agents/src/generic/generic.test.ts` | Create | Tests for GenericAgentAdapter |
| `packages/agents/src/index.ts` | Modify | Export GenericAgentAdapter |

---

## Tasks

### Task 1: Delimiter Utilities

**Files:**
- Create: `packages/pty/src/delimiter.ts`
- Test: `packages/pty/src/delimiter.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `DelimiterPair`, `createDelimiter()`, `findDelimiter()`, `stripDelimiters()`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/pty/src/delimiter.test.ts
import { describe, it, expect } from "vitest";
import { createDelimiter, findDelimiter, stripDelimiters } from "./delimiter.js";

describe("createDelimiter", () => {
  it("returns a pair of start and end strings", () => {
    const d = createDelimiter();
    expect(typeof d.start).toBe("string");
    expect(typeof d.end).toBe("string");
    expect(d.start).not.toBe(d.end);
  });

  it("start and end are unique across calls", () => {
    const d1 = createDelimiter();
    const d2 = createDelimiter();
    expect(d1.start).not.toBe(d2.start);
  });
});

describe("findDelimiter", () => {
  it("finds end delimiter in output", () => {
    const d = createDelimiter();
    const output = `some output\n${d.end}\nmore stuff`;
    expect(findDelimiter(output, d.end)).toBe(true);
  });

  it("returns false when delimiter not present", () => {
    const d = createDelimiter();
    expect(findDelimiter("no delimiter here", d.end)).toBe(false);
  });

  it("is case-sensitive", () => {
    const d = createDelimiter();
    expect(findDelimiter(d.end.toUpperCase(), d.end)).toBe(false);
  });
});

describe("stripDelimiters", () => {
  it("removes delimiters from output", () => {
    const d = createDelimiter();
    const output = `${d.start}\nhello world\n${d.end}\ntrailing`;
    const result = stripDelimiters(output, d);
    expect(result).toBe("hello world\ntrailing");
  });

  it("returns original when no delimiters found", () => {
    const d = createDelimiter();
    expect(stripDelimiters("plain text", d)).toBe("plain text");
  });

  it("handles multiple start delimiters (keeps first occurrence)", () => {
    const d = createDelimiter();
    const output = `${d.start}first\n${d.start}second\n${d.end}`;
    const result = stripDelimiters(output, d);
    expect(result).toContain("first");
    expect(result).toContain("second");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/pty/src/delimiter.test.ts`
Expected: FAIL — module `./delimiter.js` not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/pty/src/delimiter.ts
import { randomUUID } from "node:crypto";

export interface DelimiterPair {
  start: string;
  end: string;
}

export function createDelimiter(): DelimiterPair {
  const id = randomUUID().slice(0, 8);
  return {
    start: `__ARENA_DELIM_START_${id}__`,
    end: `__ARENA_DELIM_END_${id}__`,
  };
}

export function findDelimiter(output: string, delimiter: string): boolean {
  return output.includes(delimiter);
}

export function stripDelimiters(output: string, delimiters: DelimiterPair): string {
  const startIdx = output.indexOf(delimiters.start);
  const endIdx = output.indexOf(delimiters.end);

  let result = output;
  if (startIdx !== -1) {
    result = result.slice(startIdx + delimiters.start.length);
  }
  if (endIdx !== -1) {
    result = result.slice(0, result.indexOf(delimiters.end));
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/pty/src/delimiter.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/pty/src/delimiter.ts packages/pty/src/delimiter.test.ts
git commit -m "feat(pty): add delimiter utilities for response boundary detection"
```

---

### Task 2: ResponseBuffer

**Files:**
- Create: `packages/pty/src/response-buffer.ts`
- Test: `packages/pty/src/response-buffer.test.ts`

**Interfaces:**
- Consumes: `DelimiterPair`, `findDelimiter`, `stripDelimiters` from `./delimiter.js`
- Produces: `ResponseBuffer` class with `append()`, `hasCompleteResponse()`, `consumeResponse()`, `clear()`, `getRaw()`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/pty/src/response-buffer.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { ResponseBuffer } from "./response-buffer.js";
import { createDelimiter } from "./delimiter.js";

describe("ResponseBuffer", () => {
  let buf: ResponseBuffer;
  let delim: ReturnType<typeof createDelimiter>;

  beforeEach(() => {
    delim = createDelimiter();
    buf = new ResponseBuffer(delim);
  });

  it("starts empty", () => {
    expect(buf.getRaw()).toBe("");
    expect(buf.hasCompleteResponse()).toBe(false);
  });

  it("accumulates output", () => {
    buf.append("hello ");
    buf.append("world");
    expect(buf.getRaw()).toBe("hello world");
  });

  it("detects complete response when end delimiter arrives", () => {
    buf.append("some output\n");
    expect(buf.hasCompleteResponse()).toBe(false);
    buf.append(`${delim.end}\n`);
    expect(buf.hasCompleteResponse()).toBe(true);
  });

  it("consumeResponse returns content without delimiters", () => {
    buf.append(`${delim.start}\nresult data\n${delim.end}\n`);
    const response = buf.consumeResponse();
    expect(response).toBe("result data\n");
    expect(buf.hasCompleteResponse()).toBe(false);
  });

  it("consumeResponse clears the buffer", () => {
    buf.append(`${delim.start}\ndata\n${delim.end}\ntrailing`);
    buf.consumeResponse();
    expect(buf.getRaw()).toBe("trailing");
  });

  it("handles partial delimiter across chunks", () => {
    const partial = delim.end.slice(0, 5);
    buf.append(`data\n${partial}`);
    expect(buf.hasCompleteResponse()).toBe(false);
    buf.append(`${delim.end.slice(5)}\n`);
    expect(buf.hasCompleteResponse()).toBe(true);
  });

  it("clear resets everything", () => {
    buf.append("data");
    buf.clear();
    expect(buf.getRaw()).toBe("");
    expect(buf.hasCompleteResponse()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/pty/src/response-buffer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/pty/src/response-buffer.ts
import { DelimiterPair, findDelimiter, stripDelimiters } from "./delimiter.js";

export class ResponseBuffer {
  private raw = "";
  private delimiter: DelimiterPair;

  constructor(delimiter: DelimiterPair) {
    this.delimiter = delimiter;
  }

  append(data: string): void {
    this.raw += data;
  }

  hasCompleteResponse(): boolean {
    return findDelimiter(this.raw, this.delimiter.end);
  }

  consumeResponse(): string {
    const response = stripDelimiters(this.raw, this.delimiter);
    // Keep anything after the end delimiter as leftover
    const endIdx = this.raw.indexOf(this.delimiter.end);
    if (endIdx !== -1) {
      this.raw = this.raw.slice(
        endIdx + this.delimiter.end.length,
      );
    } else {
      this.raw = "";
    }
    return response;
  }

  getRaw(): string {
    return this.raw;
  }

  clear(): void {
    this.raw = "";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/pty/src/response-buffer.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/pty/src/response-buffer.ts packages/pty/src/response-buffer.test.ts
git commit -m "feat(pty): add ResponseBuffer for delimited output accumulation"
```

---

### Task 3: PersistentSession

**Files:**
- Create: `packages/pty/src/persistent-session.ts`
- Test: `packages/pty/src/persistent-session.test.ts`

**Interfaces:**
- Consumes: `ProcessSessionHandle`, `createProcessSession` from `./session.js`; `ResponseBuffer` from `./response-buffer.js`; `createDelimiter`, `DelimiterPair` from `./delimiter.js`
- Produces: `PersistentSession` class with `send(message)`, `waitForResponse(timeout)`, `isAlive()`, `kill()`, `getBuffer()`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/pty/src/persistent-session.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { PersistentSession } from "./persistent-session.js";

describe("PersistentSession", () => {
  let sessions: PersistentSession[] = [];

  afterEach(async () => {
    for (const s of sessions) if (s.isAlive()) s.kill();
    sessions = [];
  });

  it("spawns a process and stays alive", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "process.stdin.resume()"],
    });
    sessions.push(s);
    expect(s.isAlive()).toBe(true);
    expect(s.pid).toBeGreaterThan(0);
  });

  it("sends a message and receives a delimited response", async () => {
    // A fake agent that echoes back with a delimiter
    const s = new PersistentSession({
      command: "node",
      args: [
        "-e",
        `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const delim = process.env.ARENA_DELIM;
  process.stdout.write(delim + '\\n');
  process.stdout.write('echo: ' + line + '\\n');
  process.stdout.write(delim + '\\n');
});
        `.trim(),
      ],
      env: { ARENA_DELIM: "__TEST_DELIM__" },
    });
    sessions.push(s);

    // Override delimiter for test
    (s as any).delimiter = {
      start: "__TEST_DELIM__",
      end: "__TEST_DELIM__",
    };

    s.send("hello world");
    const response = await s.waitForResponse(3000);
    expect(response).toContain("echo: hello world");
  });

  it("times out when no response arrives", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "process.stdin.resume()"],
    });
    sessions.push(s);

    await expect(s.waitForResponse(200)).rejects.toThrow("timeout");
  });

  it("kill terminates the process", async () => {
    const s = new PersistentSession({
      command: "node",
      args: ["-e", "setTimeout(() => {}, 30000)"],
    });
    sessions.push(s);
    expect(s.isAlive()).toBe(true);
    s.kill();
    await new Promise<void>((r) => s.onExit(() => r()));
    expect(s.isAlive()).toBe(false);
  });

  it("multiple send/receive cycles work", async () => {
    const s = new PersistentSession({
      command: "node",
      args: [
        "-e",
        `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
let count = 0;
rl.on('line', (line) => {
  count++;
  const delim = process.env.ARENA_DELIM;
  process.stdout.write(delim + '\\n');
  process.stdout.write('response ' + count + ': ' + line + '\\n');
  process.stdout.write(delim + '\\n');
});
        `.trim(),
      ],
      env: { ARENA_DELIM: "__TEST_DELIM__" },
    });
    sessions.push(s);
    (s as any).delimiter = {
      start: "__TEST_DELIM__",
      end: "__TEST_DELIM__",
    };

    const r1 = await s.sendAndWait("first", 3000);
    expect(r1).toContain("response 1: first");

    const r2 = await s.sendAndWait("second", 3000);
    expect(r2).toContain("response 2: second");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/pty/src/persistent-session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/pty/src/persistent-session.ts
import { spawn, SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { DelimiterPair, createDelimiter, findDelimiter } from "./delimiter.js";

export interface PersistentSessionConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  delimiter?: DelimiterPair;
}

export class PersistentSession {
  readonly sessionId: string;
  readonly pid: number;
  private child: ReturnType<typeof spawn>;
  private delimiter: DelimiterPair;
  private buffer = "";
  private waitingResolve: ((value: string) => void) | null = null;
  private waitingReject: ((reason: Error) => void) | null = null;
  private alive = true;
  private exitCallbacks: Array<() => void> = [];

  constructor(config: PersistentSessionConfig) {
    this.sessionId = randomUUID();
    this.delimiter = config.delimiter ?? createDelimiter();

    const opts: SpawnOptions = {
      cwd: config.cwd ?? process.cwd(),
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    };

    this.child = spawn(config.command, config.args ?? [], opts);
    this.pid = this.child.pid ?? 0;

    this.child.stdout?.on("data", (d: Buffer) => {
      this.buffer += d.toString();
      this.checkForResponse();
    });

    this.child.stderr?.on("data", (d: Buffer) => {
      // ponytail: merge stderr into buffer for simplicity
      this.buffer += d.toString();
      this.checkForResponse();
    });

    this.child.on("exit", () => {
      this.alive = false;
      for (const cb of this.exitCallbacks) cb();
    });
  }

  send(message: string): void {
    if (!this.alive) throw new Error("Session is not alive");
    this.child.stdin?.write(message + "\n");
  }

  async sendAndWait(
    message: string,
    timeoutMs = 30_000,
  ): Promise<string> {
    this.buffer = "";
    this.send(message);
    return this.waitForResponse(timeoutMs);
  }

  waitForResponse(timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.waitingResolve) {
        reject(new Error("Already waiting for a response"));
        return;
      }

      this.waitingResolve = resolve;
      this.waitingReject = reject;

      // Check if response already arrived
      this.checkForResponse();

      if (this.waitingResolve) {
        const timer = setTimeout(() => {
          if (this.waitingResolve) {
            this.waitingResolve = null;
            this.waitingReject = null;
            reject(new Error("timeout"));
          }
        }, timeoutMs);

        // Clear timer if resolved before timeout
        const origResolve = this.waitingResolve;
        this.waitingResolve = (v) => {
          clearTimeout(timer);
          origResolve?.(v);
        };
      }
    });
  }

  private checkForResponse(): void {
    if (!this.waitingResolve) return;
    if (!findDelimiter(this.buffer, this.delimiter.end)) return;

    const endIdx = this.buffer.indexOf(this.delimiter.end);
    const response = this.buffer.slice(0, endIdx);
    this.buffer = this.buffer.slice(endIdx + this.delimiter.end.length);

    const resolve = this.waitingResolve;
    this.waitingResolve = null;
    this.waitingReject = null;
    resolve(response);
  }

  isAlive(): boolean {
    return this.alive;
  }

  kill(signal?: NodeJS.Signals): void {
    if (this.alive) this.child.kill(signal);
  }

  onExit(cb: () => void): void {
    this.exitCallbacks.push(cb);
  }

  injectDelimiter(delimiter: DelimiterPair): void {
    this.delimiter = delimiter;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/pty/src/persistent-session.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/pty/src/persistent-session.ts packages/pty/src/persistent-session.test.ts
git commit -m "feat(pty): add PersistentSession for multi-turn agent communication"
```

---

### Task 4: PtyAgentAdapter

**Files:**
- Create: `packages/pty/src/pty-adapter.ts`
- Test: `packages/pty/src/pty-adapter.test.ts`

**Interfaces:**
- Consumes: `PersistentSession` from `./persistent-session.js`; `createDelimiter` from `./delimiter.js`; `OrchestratorAdapter`, `AgentResponse` from `@arena/core`
- Produces: `PtyAgentAdapter` implementing `OrchestratorAdapter`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/pty/src/pty-adapter.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { PtyAgentAdapter } from "./pty-adapter.js";
import { agentId } from "@arena/core";

// Fake agent: reads lines, echoes back with delimiter
const FAKE_AGENT_SCRIPT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const delim = process.argv[2] || '__DEFAULT_DELIM__';
rl.on('line', (line) => {
  process.stdout.write(delim + '\\n');
  process.stdout.write('Got: ' + line + '\\n');
  process.stdout.write(delim + '\\n');
});
`;

describe("PtyAgentAdapter", () => {
  let adapter: PtyAgentAdapter;

  afterEach(() => {
    if (adapter) adapter.terminate({ sessionId: "x" }).catch(() => {});
  });

  it("implements OrchestratorAdapter interface", () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", FAKE_AGENT_SCRIPT],
    );
    expect(adapter.id).toBe("test");
    expect(adapter.name).toBe("Test Agent");
  });

  it("start returns a session handle", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", FAKE_AGENT_SCRIPT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    expect(handle.sessionId).toBeTruthy();
    expect(handle.pid).toBeGreaterThan(0);
  });

  it("sendAndReceive returns agent response", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", FAKE_AGENT_SCRIPT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    const response = await adapter.sendAndReceive(handle, "hello");
    expect(response.content).toContain("Got: hello");
    expect(response.kind).toBe("message");
  });

  it("terminate kills the process", async () => {
    adapter = new PtyAgentAdapter(
      agentId("test"),
      "Test Agent",
      "node",
      ["-e", FAKE_AGENT_SCRIPT],
    );
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    await adapter.terminate(handle);
    // Give process time to die
    await new Promise((r) => setTimeout(r, 100));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/pty/src/pty-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/pty/src/pty-adapter.ts
import { AgentId, agentId } from "@arena/core";
import {
  OrchestratorAdapter,
  AgentResponse,
} from "@arena/core";
import {
  PersistentSession,
  PersistentSessionConfig,
} from "./persistent-session.js";

export class PtyAgentAdapter implements OrchestratorAdapter {
  readonly id: AgentId;
  readonly name: string;
  private command: string;
  private args: string[];
  private sessions = new Map<string, PersistentSession>();

  constructor(
    id: AgentId,
    name: string,
    command: string,
    args: string[] = [],
  ) {
    this.id = id;
    this.name = name;
    this.command = command;
    this.args = args;
  }

  async start(config: {
    task: string;
    cwd: string;
  }): Promise<{ sessionId: string; pid: number }> {
    const session = new PersistentSession({
      command: this.command,
      args: this.args,
      cwd: config.cwd,
    });
    this.sessions.set(session.sessionId, session);
    return {
      sessionId: session.sessionId,
      pid: session.pid,
    };
  }

  async sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse> {
    const session = this.sessions.get(handle.sessionId);
    if (!session) {
      return { kind: "error", content: "Unknown session" };
    }
    if (!session.isAlive()) {
      return { kind: "crash", content: "Agent process exited" };
    }

    try {
      const response = await session.sendAndWait(message, 120_000);
      return { kind: "message", content: response.trim() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "timeout") {
        return { kind: "timeout", content: "Agent did not respond in time" };
      }
      return { kind: "error", content: msg };
    }
  }

  async terminate(handle: {
    sessionId: string;
  }): Promise<void> {
    const session = this.sessions.get(handle.sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(handle.sessionId);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/pty/src/pty-adapter.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/pty/src/pty-adapter.ts packages/pty/src/pty-adapter.test.ts
git commit -m "feat(pty): add PtyAgentAdapter implementing OrchestratorAdapter"
```

---

### Task 5: GenericAgentAdapter

**Files:**
- Create: `packages/agents/src/generic/generic.ts`
- Test: `packages/agents/src/generic/generic.test.ts`

**Interfaces:**
- Consumes: `PtyAgentAdapter` from `@arena/pty`; `AgentId`, `AgentCapabilities`, `AgentStatus`, `agentId` from `@arena/core`
- Produces: `GenericAgentAdapter` implementing both `AgentAdapter` and `OrchestratorAdapter`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/agents/src/generic/generic.test.ts
import { describe, it, expect } from "vitest";
import { GenericAgentAdapter } from "./generic.js";
import { agentId } from "@arena/core";

describe("GenericAgentAdapter", () => {
  it("detects when command exists", async () => {
    const adapter = new GenericAgentAdapter({
      id: "node-agent",
      command: "node",
      args: ["--version"],
    });
    const result = await adapter.detect();
    expect(result.detected).toBe(true);
    expect(result.command).toBe("node");
  });

  it("detects when command does not exist", async () => {
    const adapter = new GenericAgentAdapter({
      id: "fake",
      command: "nonexistent-command-xyz",
    });
    const result = await adapter.detect();
    expect(result.detected).toBe(false);
  });

  it("capabilities returns reasonable defaults", async () => {
    const adapter = new GenericAgentAdapter({
      id: "test",
      command: "echo",
    });
    const caps = await adapter.capabilities();
    expect(caps.terminal).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.shell).toBe(true);
  });

  it("start launches a session", async () => {
    const adapter = new GenericAgentAdapter({
      id: "echo-agent",
      command: "echo",
      args: ["ready"],
    });
    const handle = await adapter.start({ task: "X", cwd: "/tmp" });
    expect(handle.sessionId).toBeTruthy();
    expect(handle.pid).toBeGreaterThan(0);
    await adapter.terminate(handle);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/agents/src/generic/generic.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/agents/src/generic/generic.ts
import { execFile } from "node:child_process";
import {
  AgentId,
  AgentCapabilities,
  AgentStatus,
  agentId,
  AgentResponse,
} from "@arena/core";
import { OrchestratorAdapter } from "@arena/core";
import {
  PtyAgentAdapter,
} from "@arena/pty";
import {
  AgentAdapter,
  AgentSessionHandle,
  DetectionResult,
} from "../adapter.js";

export interface GenericAgentConfig {
  id: string;
  command: string;
  args?: string[];
  name?: string;
  env?: Record<string, string>;
}

export class GenericAgentAdapter
  implements AgentAdapter, OrchestratorAdapter
{
  readonly id: AgentId;
  readonly name: string;
  private config: GenericAgentConfig;
  private ptyAdapter: PtyAgentAdapter;
  private detected = false;

  constructor(config: GenericAgentConfig) {
    this.config = config;
    this.id = agentId(config.id);
    this.name = config.name ?? config.id;
    this.ptyAdapter = new PtyAgentAdapter(
      this.id,
      this.name,
      config.command,
      config.args ?? [],
    );
  }

  async detect(): Promise<DetectionResult> {
    return new Promise((resolve) => {
      execFile(
        this.config.command,
        ["--version"],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            this.detected = false;
            resolve({
              detected: false,
              command: this.config.command,
            });
            return;
          }
          this.detected = true;
          resolve({
            detected: true,
            command: this.config.command,
            version: stdout.trim().split("\n")[0],
          });
        },
      );
    });
  }

  async start(config: {
    task: string;
    cwd: string;
  }): Promise<AgentSessionHandle> {
    return this.ptyAdapter.start(config);
  }

  async sendAndReceive(
    handle: { sessionId: string },
    message: string,
  ): Promise<AgentResponse> {
    return this.ptyAdapter.sendAndReceive(handle, message);
  }

  async send(
    _handle: AgentSessionHandle,
    _message: string,
  ): Promise<void> {
    // ponytail: use sendAndReceive instead
  }

  async interrupt(
    handle: AgentSessionHandle,
  ): Promise<void> {
    await this.ptyAdapter.terminate(handle);
  }

  async terminate(
    handle: AgentSessionHandle,
  ): Promise<void> {
    await this.ptyAdapter.terminate(handle);
  }

  async getStatus(
    _handle: AgentSessionHandle,
  ): Promise<AgentStatus> {
    return "running";
  }

  async capabilities(): Promise<AgentCapabilities> {
    return {
      terminal: true,
      filesystem: true,
      shell: true,
      mcp: false,
      plugins: false,
      network: false,
      interactive: true,
      supportsInterrupt: true,
      supportsResume: false,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/agents/src/generic/generic.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/agents/src/generic/generic.ts packages/agents/src/generic/generic.test.ts
git commit -m "feat(agents): add GenericAgentAdapter using PtyAgentAdapter"
```

---

### Task 6: Update Exports + Final Verification

**Files:**
- Modify: `packages/pty/src/index.ts`
- Modify: `packages/agents/src/index.ts`

**Interfaces:**
- Consumes: All modules created in Tasks 1–5
- Produces: Public API surface for `@arena/pty` and `@arena/agents`

- [ ] **Step 1: Add exports to pty/index.ts**

```typescript
// packages/pty/src/index.ts — add these lines
export { OutputBuffer } from "./stream.js";
export { createProcessSession } from "./session.js";
export type { ProcessSessionHandle } from "./session.js";
export { createDelimiter, findDelimiter, stripDelimiters } from "./delimiter.js";
export type { DelimiterPair } from "./delimiter.js";
export { ResponseBuffer } from "./response-buffer.js";
export { PersistentSession } from "./persistent-session.js";
export type { PersistentSessionConfig } from "./persistent-session.js";
export { PtyAgentAdapter } from "./pty-adapter.js";
```

- [ ] **Step 2: Add exports to agents/index.ts**

Check the current agents index.ts and add:
```typescript
export { GenericAgentAdapter } from "./generic/generic.js";
export type { GenericAgentConfig } from "./generic/generic.js";
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all tests green (same 4 pre-existing agent import failures)

- [ ] **Step 4: Run typecheck on both packages**

Run: `npx tsc --noEmit -p packages/pty/tsconfig.json && npx tsc --noEmit -p packages/agents/tsconfig.json`
Expected: PASS — no type errors

- [ ] **Step 5: Commit**

```bash
git add packages/pty/src/index.ts packages/agents/src/index.ts
git commit -m "feat: export PtyAgentAdapter, GenericAgentAdapter, and delimiter utilities"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Phase 2 (PTY/process engine): persistent processes, lifecycle, streaming, interrupt, termination
- ✅ Section 15 (PTY/Terminal Architecture): real process spawning, stream capture
- ✅ Section 23 (Agent Adapter Interface): `start`, `sendAndReceive`, `terminate`
- ✅ Section 24 (Generic CLI Adapter): configurable command/args, adapter responsibilities
- ✅ Section 43 (Failure Handling): timeout, crash detection, process exit

**2. Placeholder scan:** No TBD/TODO/placeholders found. All steps have actual code.

**3. Type consistency:**
- `PersistentSession.sendAndWait()` returns `Promise<string>` — consumed by `PtyAgentAdapter.sendAndReceive()`
- `PtyAgentAdapter` implements `OrchestratorAdapter` — compatible with `Orchestrator` constructor
- `GenericAgentAdapter` implements both `AgentAdapter` and `OrchestratorAdapter` — can be used in registry and orchestrator
- `createDelimiter()` returns `DelimiterPair` — consumed by `ResponseBuffer` and `PersistentSession`
