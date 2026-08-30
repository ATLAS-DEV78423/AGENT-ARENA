import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventStore } from "./event-store.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("EventStore", () => {
  let dir: string;
  let store: EventStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "arena-test-"));
    store = new EventStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends events to JSONL file", async () => {
    await store.append("sess-1", { type: "session.created", state: "CREATED", timestamp: "2026-01-01T00:00:00Z" });
    await store.append("sess-1", { type: "analysis.complete", state: "DISCUSSING", timestamp: "2026-01-01T00:01:00Z" });
    const events = await store.load("sess-1");
    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe("session.created");
    expect(events[1]!.type).toBe("analysis.complete");
  });

  it("creates separate files per session", async () => {
    await store.append("sess-A", { type: "session.created", state: "CREATED", timestamp: "2026-01-01T00:00:00Z" });
    await store.append("sess-B", { type: "session.created", state: "CREATED", timestamp: "2026-01-01T00:00:00Z" });
    const a = await store.load("sess-A");
    const b = await store.load("sess-B");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("returns empty array for nonexistent session", async () => {
    const events = await store.load("nonexistent");
    expect(events).toHaveLength(0);
  });

  it("file exists after first append", async () => {
    expect(existsSync(store.getPath("sess-1"))).toBe(false);
    await store.append("sess-1", { type: "test", state: "CREATED", timestamp: "2026-01-01T00:00:00Z" });
    expect(existsSync(store.getPath("sess-1"))).toBe(true);
  });

  it("loads events in order", async () => {
    for (let i = 0; i < 10; i++) {
      await store.append("sess-1", { type: `event-${i}`, state: "CREATED", timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` });
    }
    const events = await store.load("sess-1");
    expect(events).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(events[i]!.type).toBe(`event-${i}`);
    }
  });

  it("recovers from partial writes", async () => {
    await store.append("sess-1", { type: "event-1", state: "CREATED", timestamp: "2026-01-01T00:00:00Z" });
    // Simulate partial write by appending invalid JSON
    const fs = await import("node:fs");
    fs.appendFileSync(store.getPath("sess-1"), "invalid json\n");
    // Should still load the valid events
    const events = await store.load("sess-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("event-1");
  });
});
